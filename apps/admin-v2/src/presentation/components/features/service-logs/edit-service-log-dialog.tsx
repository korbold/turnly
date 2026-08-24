'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, ArrowLeftRight, MoreHorizontal, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { MoneyInput } from '@/presentation/components/ui/money-input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { apiErrorMessage } from '@/shared/utils/api-error';
import {
  PRICE_CHANGE_REASONS,
  REASON_REQUIRES_NOTE,
} from '@/shared/constants/price-change-reasons';
import { useUpdateServiceLog, useUpdateServiceLogItems } from '@/presentation/hooks/use-service-logs';
import { useTeam } from '@/presentation/hooks/use-team';
import { useMe } from '@/presentation/hooks/use-auth';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import { useServices } from '@/presentation/hooks/use-services';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import { ServiceCombobox } from '@/presentation/components/features/service-logs/service-combobox';
import type { PaymentMethod, ServiceLog } from '@/domain/entities/service-log';
import type { Service } from '@/domain/entities/service';
import { formatCounterCurrency } from '@/shared/utils/format';

// ─── types ───────────────────────────────────────────────────────────────────

interface LineItem {
  /** Stable unique key for this row: variantId when the item is a variant,
      serviceId otherwise. Used as React key and for targeting updates/removes. */
  key: string;
  serviceId: string;
  serviceName: string;
  variantId: string | null;
  variantLabel: string | null;
  qty: number;
  unitPrice: number;
  /** Contra qué se mide el desvío, siguiendo la misma regla que el backend:
      una línea que ya estaba en el registro se compara con lo que ya valía
      (un descuento con motivo no vuelve a pedirlo cada vez que se corrige la
      cantidad); una línea nueva se compara con el catálogo. */
  basePrice: number;
  availableVariants: ServiceVariantSlim[] | null;
}

/** A counter-sale line. Kept apart from LineItem because a product has
    no variants and no catalog lookup — and because sending it back as a
    service line put its uuid in service_logs.service_id and broke the
    foreign key. */
interface ProductLine {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
}

interface ServiceVariantSlim {
  id: string;
  label: string;
  price: number;
}

/** Derive a stable row key that is unique even when the same service
    appears twice with different variants. */
function rowKey(serviceId: string, variantId: string | null): string {
  return variantId ?? serviceId;
}

// ─── helpers (mirrors new-service-modal.tsx) ─────────────────────────────────

async function fetchVariantsForService(serviceId: string): Promise<ServiceVariantSlim[]> {
  const { default: api } = await import('@/infrastructure/api/client');
  const { data: res } = await api.get(`/services/${serviceId}/variants`);
  const raw = (res.data ?? []) as Array<Record<string, unknown>>;
  return raw
    .filter((v) => v.is_active !== false)
    .map((v) => ({
      id: String(v.id),
      label: String(v.label ?? ''),
      price: Number(v.price ?? 0),
    }));
}

async function fetchSuggestedVariant(
  serviceId: string,
  resourceId: string,
): Promise<ServiceVariantSlim | null> {
  const { default: api } = await import('@/infrastructure/api/client');
  try {
    const { data: res } = await api.get(`/public/services/${serviceId}/suggested-variant`, {
      params: { resource_id: resourceId },
    });
    const d = res.data;
    if (!d || !d.variant_id) return null;
    return { id: String(d.variant_id), label: String(d.label ?? ''), price: Number(d.price ?? 0) };
  } catch {
    return null;
  }
}

// ─── constants ────────────────────────────────────────────────────────────────

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
  { value: 'other', label: 'Otro', icon: MoreHorizontal },
];

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  log: ServiceLog | null;
  open: boolean;
  onClose: () => void;
}

const formatMoney = formatCounterCurrency;

export function EditServiceLogDialog({ log, open, onClose }: Props) {
  const [attendedBy, setAttendedBy] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentBank, setPaymentBank] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [priceReason, setPriceReason] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  // Items are locked once the log is invoiced — changing prices would
  // require a nota de crédito + new invoice, which the billing service handles.
  const itemsLocked = log?.invoiced === true;

  const updateLog = useUpdateServiceLog();
  const updateItems = useUpdateServiceLogItems();
  const { data: teamData } = useTeam({ excludeRole: 'client' as const });
  const { data: me } = useMe();
  // Locking the create but not the edit leaves the hole open: register as
  // yourself, then reassign. The backend pins this too.
  const lockedToSelf = me?.user?.role === 'cashier';
  // El privilegio Precio ya no significa "puede tocar el precio" sino
  // "puede hacerlo sin justificar". Cualquiera corrige el precio de un
  // ticket; quien no lo tiene, elige motivo de la lista cerrada. Bloquear
  // acá dejaba al cajero descontar en el mostrador y no poder corregir ese
  // mismo ticket un minuto después — dos políticas para la misma pregunta.
  const { canSetPrice } = usePermissions();
  // Facturado sí es un candado de verdad: cambiar precios exigiría nota de
  // crédito y una factura nueva.
  const priceLocked = itemsLocked;
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const team = teamData?.data ?? [];
  const services = servicesData?.data ?? [];

  const servicesTotal = lineItems.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const productsTotal = productLines.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const total = servicesTotal + productsTotal;
  const isPaid = log?.paymentStatus === 'paid';

  // Centavos, no igualdad exacta: el precio va y vuelve por JSON.
  const hayDesvio = useMemo(
    () => lineItems.some((it) => Math.abs(it.unitPrice - it.basePrice) > 0.005),
    [lineItems],
  );

  // Seed state from the log when the dialog opens
  useEffect(() => {
    if (!open || !log) return;
    setAttendedBy(log.attendedBy ?? '');
    setPaymentMethod(log.paymentMethod ?? 'cash');
    setPaymentBank(log.paymentBank ?? null);
    setNotes(log.notes ?? '');
    setPriceReason('');
    setPriceNote('');

    // Build line items from log.items (multi-service) or fall back to
    // the single service on the parent row (legacy logs with no items).
    if (log.items && log.items.length > 0) {
      // item_type is what separates a counter-sale product from a service.
      // Ignoring it is how a product came back as a service line.
      setProductLines(
        log.items
          .filter((it) => it.itemType === 'product')
          .map((it) => ({
            productId:   it.refId,
            productName: it.label,
            qty:         it.qty,
            unitPrice:   it.unitPrice,
          })),
      );
      setLineItems(
        log.items.filter((it) => it.itemType !== 'product').map((it) => {
          // it.serviceId is the real service UUID (the backend now exposes
          // it per-item via the items.variant eager-load). it.refId is the
          // variant UUID for variant items, service UUID for plain items.
          // The label separator ' · ' tells us whether a variant was picked.
          const parts = it.label.split(' · ');
          const hasVariantLabel = parts.length > 1;
          const variantId = hasVariantLabel ? it.refId : null;
          return {
            key:               rowKey(it.serviceId, variantId),
            serviceId:         it.serviceId,
            serviceName:       parts[0] ?? it.label,
            variantId,
            variantLabel:      hasVariantLabel ? (parts[1] ?? null) : null,
            qty:               it.qty,
            unitPrice:         it.unitPrice,
            basePrice:         it.unitPrice,
            availableVariants: [],
          };
        })
      );
    } else if (log.serviceId) {
      setProductLines([]);
      setLineItems([{
        key:               rowKey(log.serviceId, null),
        serviceId:         log.serviceId,
        serviceName:       log.service?.name ?? 'Servicio',
        variantId:         null,
        variantLabel:      null,
        qty:               1,
        unitPrice:         log.priceCharged,
        basePrice:         log.priceCharged,
        availableVariants: [],
      }]);
    } else {
      setProductLines([]);
      setLineItems([]);
    }
  }, [open, log]);

  useEffect(() => {
    if (paymentMethod !== 'transfer') setPaymentBank(null);
  }, [paymentMethod]);

  // ── line item mutations ──────────────────────────────────────────────────

  async function handleAddLineItem(svc: Service) {
    // Dedup by serviceId only — if the service already exists (any variant),
    // increment qty instead of adding a duplicate row.
    let isNew = false;
    setLineItems((prev) => {
      const existing = prev.find((it) => it.serviceId === svc.id);
      if (existing) {
        return prev.map((it) =>
          it.serviceId === svc.id ? { ...it, qty: it.qty + 1 } : it
        );
      }
      isNew = true;
      return [
        ...prev,
        {
          key:               rowKey(svc.id, null),
          serviceId:         svc.id,
          serviceName:       svc.name,
          variantId:         null,
          variantLabel:      null,
          qty:               1,
          unitPrice:         svc.price,
          basePrice:         svc.price,
          availableVariants: null,
        },
      ];
    });

    if (!isNew) return;

    // Fetch variants + suggested variant (based on vehicle type) in parallel.
    const [variants, suggested] = await Promise.all([
      fetchVariantsForService(svc.id),
      log?.clientResourceId
        ? fetchSuggestedVariant(svc.id, log.clientResourceId)
        : Promise.resolve(null),
    ]);

    // Guard against race: user may have removed the item while loading.
    setLineItems((prev) => {
      if (!prev.some((it) => it.serviceId === svc.id && it.variantId === null)) return prev;
      return prev.map((it) => {
        if (it.serviceId !== svc.id || it.variantId !== null) return it;
        if (suggested) {
          return {
            ...it,
            key:               rowKey(svc.id, suggested.id),
            variantId:         suggested.id,
            variantLabel:      suggested.label,
            unitPrice:         suggested.price,
            basePrice:         suggested.price,
            availableVariants: variants,
          };
        }
        return { ...it, availableVariants: variants };
      });
    });
  }

  function handleRemoveLineItem(key: string) {
    setLineItems((prev) => prev.filter((it) => it.key !== key));
  }

  function handleUpdateLineItem(key: string, patch: Partial<Omit<LineItem, 'key' | 'serviceId' | 'serviceName'>>) {
    setLineItems((prev) =>
      prev.map((it) => it.key === key ? { ...it, ...patch } : it)
    );
  }

  function handlePickVariant(itemKey: string, variant: ServiceVariantSlim) {
    setLineItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        const newKey = rowKey(it.serviceId, variant.id);
        // Otra variante es otra fila del catálogo: el desvío pasa a medirse
        // contra su precio, no contra el que traía la línea anterior.
        return {
          ...it,
          key: newKey,
          variantId: variant.id,
          variantLabel: variant.label,
          unitPrice: variant.price,
          basePrice: variant.price,
        };
      })
    );
  }

  // ── submit ───────────────────────────────────────────────────────────────

  function handleUpdateProductLine(productId: string, patch: Partial<ProductLine>) {
    setProductLines((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, ...patch } : it)),
    );
  }

  function handleRemoveProductLine(productId: string) {
    setProductLines((prev) => prev.filter((it) => it.productId !== productId));
  }

  function handleSubmit() {
    if (!log) return;
    if (lineItems.length === 0 && productLines.length === 0) {
      toast.error('Agrega al menos un servicio o producto');
      return;
    }
    const missingVariant = lineItems.find(
      (it) => Array.isArray(it.availableVariants) && it.availableVariants.length > 0 && !it.variantId
    );
    if (missingVariant) {
      toast.error(`Elige la variante para "${missingVariant.serviceName}"`);
      return;
    }
    if (isPaid && paymentMethod === 'transfer' && !paymentBank) {
      toast.error('Selecciona el banco emisor');
      return;
    }

    const patchLog = updateLog.mutateAsync({
      id: log.id,
      data: {
        attendedBy,
        paymentMethod: isPaid ? paymentMethod : undefined,
        paymentBank: isPaid && paymentMethod === 'transfer' ? paymentBank : null,
        // UpdateServiceLogData.notes is string | undefined (no null).
        // Omitting the field when empty is acceptable; the backend leaves
        // the existing notes intact. Clearing notes requires a separate API change.
        notes: notes.trim() || undefined,
      },
    });

    const patchItems = updateItems.mutateAsync({
      id: log.id,
      items: [
        ...lineItems.map((it) => ({
          itemType:   'service_variant' as const,
          serviceId:  it.serviceId,
          variantId:  it.variantId,
          label:      it.variantLabel ? `${it.serviceName} · ${it.variantLabel}` : it.serviceName,
          qty:        it.qty,
          unitPrice:  it.unitPrice,
        })),
        ...productLines.map((it) => ({
          itemType:   'product' as const,
          productId:  it.productId,
          label:      it.productName,
          qty:        it.qty,
          unitPrice:  it.unitPrice,
        })),
      ],
      meta: hayDesvio && priceReason
        ? { priceChangeReason: priceReason, priceChangeNote: priceNote.trim() || undefined }
        : undefined,
    });

    Promise.all([patchLog, patchItems]).then(() => {
      toast.success('Registro actualizado');
      onClose();
    }).catch((e) => {
      toast.error(apiErrorMessage(e, 'Error al actualizar'));
    });
  }

  const isPending = updateLog.isPending || updateItems.isPending;
  const canSubmit = !!attendedBy && (lineItems.length > 0 || productLines.length > 0) &&
    lineItems.every(
      (it) => !Array.isArray(it.availableVariants) || it.availableVariants.length === 0 || !!it.variantId
    ) &&
    // Misma regla que el mostrador: el motivo sólo se exige a quien no tiene
    // el privilegio Precio, pero "Otro" siempre pide nota lo elija quien lo
    // elija — una nota a medias es peor que ninguna.
    (!hayDesvio ||
      (canSetPrice
        ? priceReason !== REASON_REQUIRES_NOTE || !!priceNote.trim()
        : !!priceReason && (priceReason !== REASON_REQUIRES_NOTE || !!priceNote.trim())));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
          <DialogDescription>Modifica servicios, empleado y método de pago.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">

          {/* ── Services ───────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <Label>
                Servicios{' '}
                {lineItems.length > 0 && (
                  <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                    ({lineItems.length})
                  </span>
                )}
                {itemsLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--warning-100)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--warning-700)]">
                    Facturado · solo lectura
                  </span>
                )}
              </Label>
              {lineItems.length > 0 && (
                <span
                  className="font-mono text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatMoney(servicesTotal)}
                </span>
              )}
            </div>

            {!itemsLocked && (
              <ServiceCombobox
                services={services}
                selected={null}
                recentIds={[]}
                isLoading={servicesLoading}
                onSelect={handleAddLineItem}
                placeholder={lineItems.length === 0 ? 'Selecciona un servicio…' : 'Agregar otro servicio…'}
              />
            )}

            {lineItems.length > 0 && (
              <ul className="mt-2 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {lineItems.map((it) => {
                  const variantsAvailable = Array.isArray(it.availableVariants) ? it.availableVariants : null;
                  const needsVariantPick = variantsAvailable && variantsAvailable.length > 0 && !it.variantId;
                  return (
                    <li
                      key={it.key}
                      className={cn('rounded-md px-2 py-1.5', needsVariantPick && 'bg-[var(--warning-50)]')}
                    >
                      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--fg-strong)]">
                            {it.serviceName}
                          </p>
                          {it.variantLabel && (
                            <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)]">
                              {it.variantLabel}
                            </p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          step="1"
                          value={it.qty}
                          disabled={itemsLocked}
                          onChange={(e) =>
                            handleUpdateLineItem(it.key, {
                              qty: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="h-8 w-16 text-center"
                          aria-label="Cantidad"
                        />
                        <MoneyInput
                          value={it.unitPrice}
                          disabled={priceLocked}
                          onChange={(unitPrice) =>
                            handleUpdateLineItem(it.key, { unitPrice })
                          }
                          className="h-8 w-24"
                          aria-label="Precio unitario"
                        />
                        {!itemsLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(it.key)}
                            className="rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--danger-50)] hover:text-[var(--danger-600)] cursor-pointer"
                            aria-label={`Quitar ${it.serviceName}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {needsVariantPick && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                            Elige variante:
                          </span>
                          {variantsAvailable.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handlePickVariant(it.key, v)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] font-medium text-[var(--fg-strong)] transition-colors hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] cursor-pointer"
                            >
                              <span>{v.label}</span>
                              <span
                                className="font-mono text-[11px] tabular-nums text-[var(--fg-secondary)]"
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {formatMoney(v.price)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Products ───────────────────────────────────────────────
              Counter-sale lines. No picker to add new ones here: the
              catalog lives in the create modal. What matters is that an
              existing product stays a product on the way back out. */}
          {productLines.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <Label>
                  Productos{' '}
                  <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                    ({productLines.length})
                  </span>
                </Label>
                <span
                  className="font-mono text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatMoney(productsTotal)}
                </span>
              </div>

              <ul className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {productLines.map((it) => (
                  <li key={it.productId} className="rounded-md px-2 py-1.5">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-[var(--fg-strong)]">
                        {it.productName}
                      </p>
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        value={it.qty}
                        disabled={itemsLocked}
                        onChange={(e) =>
                          handleUpdateProductLine(it.productId, {
                            qty: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-8 w-16 text-center"
                        aria-label={`Cantidad de ${it.productName}`}
                      />
                      <MoneyInput
                        value={it.unitPrice}
                        disabled={priceLocked}
                        onChange={(unitPrice) =>
                          handleUpdateProductLine(it.productId, { unitPrice })
                        }
                        className="h-8 w-24"
                        aria-label={`Precio de ${it.productName}`}
                      />
                      {!itemsLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProductLine(it.productId)}
                          className="rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger-700)]"
                          aria-label={`Quitar ${it.productName}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* El precio se edita siempre; este selector es lo único que se
              interpone, y sólo cuando alguna línea ya no vale lo que valía. */}
          {hayDesvio && (
            <div className="space-y-2 rounded-lg border border-[var(--warning-200)] bg-[var(--warning-50)] p-3">
              <Label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                El precio no es el del catálogo · motivo
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_CHANGE_REASONS.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => {
                      setPriceReason(r.code);
                      // Una nota escrita bajo "Otro" no debe viajar en
                      // silencio si el cajero cambia de motivo después.
                      if (r.code !== REASON_REQUIRES_NOTE) setPriceNote('');
                    }}
                    aria-pressed={priceReason === r.code}
                    className={cn(
                      'cursor-pointer rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors',
                      priceReason === r.code
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sunken)]',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {priceReason === REASON_REQUIRES_NOTE && (
                <input
                  value={priceNote}
                  onChange={(e) => setPriceNote(e.target.value)}
                  maxLength={200}
                  placeholder="¿De qué se trata?"
                  aria-label="Detalle del motivo"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[14px]"
                />
              )}
            </div>
          )}

          {/* ── Employee ───────────────────────────────────────────── */}
          <div>
            <Label className="mb-1.5 block">Empleado</Label>
            <Select
              value={attendedBy}
              onValueChange={setAttendedBy}
              disabled={lockedToSelf}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empleado" />
              </SelectTrigger>
              <SelectContent>
                {team.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Payment method (only when already paid) ────────────── */}
          {isPaid && (
            <div>
              <Label className="mb-2 block">Método de pago</Label>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((opt) => {
                  const Icon = opt.icon;
                  const active = paymentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                          : 'border-[var(--border)] text-[var(--fg-strong)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'transfer' && (
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
                  <Label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Banco emisor
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ECUADOR_BANKS.map((b) => {
                      const active = paymentBank === b.slug;
                      return (
                        <button
                          key={b.slug}
                          type="button"
                          onClick={() => setPaymentBank(b.slug)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
                            active
                              ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                              : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                          )}
                        >
                          <BankChip bank={b} size={24} />
                          <span className="min-w-0 truncate text-[12px] font-medium text-[var(--fg-strong)]">
                            {b.name.replace(/^Banco\s/, '').replace(/^Cooperativa\s/, '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────── */}
          <div>
            <Label className="mb-1.5 block">Notas (opcional)</Label>
            <Textarea
              placeholder="Observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Grand total. Each section carries its own subtotal, which on a
            mixed ticket adds up to a number nobody had on screen. */}
        {lineItems.length > 0 && productLines.length > 0 && (
          <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              Total
            </span>
            <span
              className="font-mono text-[15px] font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {formatMoney(total)}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
