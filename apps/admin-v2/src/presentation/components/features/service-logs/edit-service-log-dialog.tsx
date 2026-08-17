'use client';

import { useEffect, useState } from 'react';
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
import { useUpdateServiceLog, useUpdateServiceLogItems } from '@/presentation/hooks/use-service-logs';
import { useTeam } from '@/presentation/hooks/use-team';
import { useMe } from '@/presentation/hooks/use-auth';
import { useServices } from '@/presentation/hooks/use-services';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import { ServiceCombobox } from '@/presentation/components/features/service-logs/service-combobox';
import type { PaymentMethod, ServiceLog } from '@/domain/entities/service-log';
import type { Service } from '@/domain/entities/service';

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
  availableVariants: ServiceVariantSlim[] | null;
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

export function EditServiceLogDialog({ log, open, onClose }: Props) {
  const [attendedBy, setAttendedBy] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentBank, setPaymentBank] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

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
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const team = teamData?.data ?? [];
  const services = servicesData?.data ?? [];

  const total = lineItems.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const isPaid = log?.paymentStatus === 'paid';

  // Seed state from the log when the dialog opens
  useEffect(() => {
    if (!open || !log) return;
    setAttendedBy(log.attendedBy ?? '');
    setPaymentMethod(log.paymentMethod ?? 'cash');
    setPaymentBank(log.paymentBank ?? null);
    setNotes(log.notes ?? '');

    // Build line items from log.items (multi-service) or fall back to
    // the single service on the parent row (legacy logs with no items).
    if (log.items && log.items.length > 0) {
      setLineItems(
        log.items.map((it) => {
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
            availableVariants: [],
          };
        })
      );
    } else if (log.serviceId) {
      setLineItems([{
        key:               rowKey(log.serviceId, null),
        serviceId:         log.serviceId,
        serviceName:       log.service?.name ?? 'Servicio',
        variantId:         null,
        variantLabel:      null,
        qty:               1,
        unitPrice:         log.priceCharged,
        availableVariants: [],
      }]);
    } else {
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
          availableVariants: null,
        },
      ];
    });

    if (!isNew) return;

    // Fetch variants + suggested variant (based on vehicle type) in parallel.
    const [variants, suggested] = await Promise.all([
      fetchVariantsForService(svc.id),
      log ? fetchSuggestedVariant(svc.id, log.clientResourceId) : Promise.resolve(null),
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
        return { ...it, key: newKey, variantId: variant.id, variantLabel: variant.label, unitPrice: variant.price };
      })
    );
  }

  // ── submit ───────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!log) return;
    if (lineItems.length === 0) {
      toast.error('Agrega al menos un servicio');
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
      items: lineItems.map((it) => ({
        serviceId:  it.serviceId,
        variantId:  it.variantId,
        label:      it.variantLabel ? `${it.serviceName} · ${it.variantLabel}` : it.serviceName,
        qty:        it.qty,
        unitPrice:  it.unitPrice,
      })),
    });

    Promise.all([patchLog, patchItems]).then(() => {
      toast.success('Registro actualizado');
      onClose();
    }).catch(() => {
      toast.error('Error al actualizar');
    });
  }

  const isPending = updateLog.isPending || updateItems.isPending;
  const canSubmit = !!attendedBy && lineItems.length > 0 &&
    lineItems.every(
      (it) => !Array.isArray(it.availableVariants) || it.availableVariants.length === 0 || !!it.variantId
    );

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
                  {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(total)}
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
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unitPrice}
                          disabled={itemsLocked}
                          onChange={(e) =>
                            handleUpdateLineItem(it.key, {
                              unitPrice: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-8 w-24 text-right font-mono tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
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
                                {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v.price)}
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
