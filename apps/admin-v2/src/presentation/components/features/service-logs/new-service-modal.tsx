'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Check, Plus, Loader2, X, Banknote, CreditCard, ArrowLeftRight, MoreHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { useServices } from '@/presentation/hooks/use-services';
import { useProducts } from '@/presentation/hooks/use-products';
import { useClients, useCreateClient } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useMe } from '@/presentation/hooks/use-auth';
import { useTeam } from '@/presentation/hooks/use-team';
import { useCreateServiceLog } from '@/presentation/hooks/use-service-logs';
import { ServiceCombobox } from '@/presentation/components/features/service-logs/service-combobox';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import {
  BillingProfileForm,
  EMPTY_BILLING_PROFILE,
  isBillingProfileDirty,
  isBillingProfileValid,
  type BillingProfileDraft,
} from '@/presentation/components/features/billing/billing-profile-form';
import type { Service } from '@/domain/entities/service';
import type { Product } from '@/domain/entities/product';
import type { PaymentMethod } from '@/domain/entities/service-log';
import type { ClientResource } from '@/domain/entities/client-resource';
import type { BusinessType, CustomField } from '@/domain/entities/tenant';

const RECENT_SERVICES_KEY = 'turnly:service-log:recent-services';

function loadRecentServiceIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SERVICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecentServiceId(id: string) {
  if (typeof window === 'undefined') return;
  const current = loadRecentServiceIds().filter((x) => x !== id);
  const next = [id, ...current].slice(0, 5);
  try {
    window.localStorage.setItem(RECENT_SERVICES_KEY, JSON.stringify(next));
  } catch {
    // localStorage full / disabled — silently drop, the combobox still works.
  }
}

const BUSINESS_TYPE_DEFAULT_FIELDS: Partial<Record<BusinessType, CustomField[]>> = {
  car_wash: [
    { key: 'plate', label: 'Placa', type: 'text', required: true, capitalize: 'uppercase' },
    { key: 'brand', label: 'Marca', type: 'text', required: false, capitalize: 'capitalize' },
    { key: 'model', label: 'Modelo', type: 'text', required: false, capitalize: 'capitalize' },
    { key: 'color', label: 'Color', type: 'text', required: false, capitalize: 'capitalize' },
  ],
  medical: [
    { key: 'nombre_paciente', label: 'Nombre del paciente', type: 'text', required: true, capitalize: 'capitalize' },
    { key: 'allergies', label: 'Alergias', type: 'textarea', required: false },
    { key: 'blood_type', label: 'Tipo de sangre', type: 'text', required: false, capitalize: 'uppercase' },
  ],
  gym: [
    { key: 'nombre_cliente', label: 'Nombre del cliente', type: 'text', required: true, capitalize: 'capitalize' },
    { key: 'goal', label: 'Objetivo', type: 'text', required: false },
  ],
  barbershop: [
    { key: 'nombre_cliente', label: 'Nombre del cliente', type: 'text', required: true, capitalize: 'capitalize' },
  ],
  spa: [
    { key: 'nombre_cliente', label: 'Nombre del cliente', type: 'text', required: true, capitalize: 'capitalize' },
  ],
  other: [
    { key: 'nombre_cliente', label: 'Nombre del cliente', type: 'text', required: true, capitalize: 'capitalize' },
  ],
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
  { value: 'other', label: 'Otro', icon: MoreHorizontal },
];

interface NewServiceModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * When true, render the form as an inline card (no Dialog wrapper,
   * no backdrop) so the page can use it as a sticky right-rail in the
   * master-detail layout. Below the breakpoint we still fall back to
   * the Dialog mobile-friendly behaviour.
   */
  embedded?: boolean;
}

interface LineItem {
  service: Service;
  qty: number;
  unitPrice: number;
  /** Picked variant — when present, the backend persists this as the
      item's `ref_id` (item_type=service_variant) instead of the parent
      service id. Required when the service has variants registered. */
  variantId: string | null;
  variantLabel: string | null;
  /** Variants available for this service. Empty array = service has no
      variants → use base price. `null` while we're still fetching. */
  availableVariants: ServiceVariantSlim[] | null;
}

interface ServiceVariantSlim {
  id: string;
  label: string;
  price: number;
}

/** A product sold off the shelf. Priced from the inventory record. */
interface ProductLine {
  product: Product;
  qty: number;
  unitPrice: number;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
}

async function fetchVariantsForService(serviceId: string): Promise<ServiceVariantSlim[]> {
  // Direct fetch via the shared axios client — keeps the modal
  // self-contained without spinning up a dedicated query key per
  // service id added.
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

export function NewServiceModal({ open, onClose, embedded = false }: NewServiceModalProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientResourceId, setSelectedClientResourceId] = useState<string | null>(null);
  const [selectedClientResource, setSelectedClientResource] = useState<ClientResource | null>(null);
  const [attendedBy, setAttendedBy] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentBank, setPaymentBank] = useState<string | null>(null);
  const [paymentTiming, setPaymentTiming] = useState<'now' | 'later'>('now');
  const [notes, setNotes] = useState('');
  const [recentServiceIds, setRecentServiceIds] = useState<string[]>([]);

  // Total = sum of line items. Stays the source of truth for the price
  // shown in the footer + sent to the backend.
  // Kept apart so each section shows its own subtotal: a single figure
  // sitting under "Servicios" while it silently included products read
  // as a wrong service price.
  const servicesTotal = lineItems.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const productsTotal = productLines.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const total = servicesTotal + productsTotal;

  // Drop the bank pick whenever the cashier flips away from transfer.
  // Otherwise the form would carry a stale slug into the next submit.
  useEffect(() => {
    if (paymentMethod !== 'transfer') setPaymentBank(null);
  }, [paymentMethod]);

  // Drop method + bank when deferring cobro — the cashier captures
  // them later via the dedicated payment endpoint.
  useEffect(() => {
    if (paymentTiming === 'later') setPaymentBank(null);
  }, [paymentTiming]);

  // Seed recent-services list once on mount (and refresh when the panel
  // opens) so the cashier sees their muscle-memory picks at the top.
  useEffect(() => {
    if (open) setRecentServiceIds(loadRecentServiceIds());
  }, [open]);

  // Re-resolve variants when the cashier swaps the client/recurso.
  // A Lavada premium picked while the Kia SUV was selected has to drop
  // to the sedán price (or land in "needs pick" state) when the cashier
  // flips to the Chevrolet sedán. Manually-overridden lines get
  // overridden too — the new vehicle is the authoritative signal.
  useEffect(() => {
    if (!selectedClientResourceId) return;
    if (lineItems.length === 0) return;
    let cancelled = false;
    const resourceId = selectedClientResourceId;

    (async () => {
      const updates = await Promise.all(
        lineItems.map(async (it) => {
          // Service has no variants → base price stays, nothing to do.
          if (Array.isArray(it.availableVariants) && it.availableVariants.length === 0) {
            return { id: it.service.id, patch: null as Partial<LineItem> | null };
          }
          const suggested = await fetchSuggestedVariant(it.service.id, resourceId);
          if (suggested) {
            return {
              id: it.service.id,
              patch: {
                variantId: suggested.id,
                variantLabel: suggested.label,
                unitPrice: suggested.price,
              } as Partial<LineItem>,
            };
          }
          // No match for the new vehicle → drop the picked variant so
          // the line lights up the inline picker again.
          return {
            id: it.service.id,
            patch: {
              variantId: null,
              variantLabel: null,
            } as Partial<LineItem>,
          };
        }),
      );

      if (cancelled) return;
      setLineItems((prev) =>
        prev.map((it) => {
          const u = updates.find((x) => x.id === it.service.id);
          return u?.patch ? { ...it, ...u.patch } : it;
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally NOT depending on lineItems — only the resource id.
    // Re-running on every line change would loop indefinitely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientResourceId]);

  const { data: servicesData, isLoading: servicesLoading } = useServices();
  // Consumables are burned by a service's recipe, never sold on their own.
  const { data: productsPage } = useProducts({ perPage: 100, active: true });
  const sellableProducts = useMemo(
    () => (productsPage?.data ?? []).filter((p) => p.type !== 'consumable'),
    [productsPage],
  );
  const { data: clientsData, isLoading: clientsLoading } = useClients(1, clientSearch || undefined);
  const { data: settings } = useSettings();
  const { data: teamData } = useTeam({ excludeRole: 'client' as const });
  const { data: me } = useMe();
  // A cashier logs their own work: the field is theirs and locked. The backend
  // pins it too — this only spares them a pointless choice.
  const lockedToSelf = me?.user?.role === 'cashier';
  // Derived rather than synced through an effect: for a cashier the field simply
  // *is* their own id, so there is no second source of truth to keep in step.
  const effectiveAttendedBy = lockedToSelf ? (me?.user?.id ?? '') : attendedBy;
  const createMutation = useCreateServiceLog();
  const createClient = useCreateClient();

  const tenantCustomFields = settings?.customFields ?? [];
  const businessType = settings?.businessType ?? null;
  const customFields = useMemo<CustomField[]>(() => {
    if (tenantCustomFields.length > 0) return tenantCustomFields;
    if (businessType && BUSINESS_TYPE_DEFAULT_FIELDS[businessType]) {
      return BUSINESS_TYPE_DEFAULT_FIELDS[businessType]!;
    }
    return [];
  }, [tenantCustomFields, businessType]);
  const hasCustomFields = customFields.length > 0;

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [billingProfile, setBillingProfile] = useState<BillingProfileDraft>(EMPTY_BILLING_PROFILE);
  const [walkInClientName, setWalkInClientName] = useState('');

  // Mirrors the backend's name detection (ClientResourceController::
  // extractClientName). When the tenant configured no name field the
  // walk-in would land unowned, so we ask for the name right here.
  const hasNameField = useMemo(
    () =>
      customFields.some((f) => {
        const label = f.label?.toLowerCase() ?? '';
        return f.key === 'nombre' || (label.includes('nombre') && label.includes('cliente'));
      }),
    [customFields]
  );

  function applyCapitalization(value: string, mode?: 'none' | 'uppercase' | 'capitalize' | 'lowercase'): string {
    if (mode === 'uppercase') return value.toUpperCase();
    if (mode === 'lowercase') return value.toLowerCase();
    if (mode === 'capitalize') {
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return value;
  }

  async function handleQuickCreateClient() {
    const text = clientSearch.trim();
    if (!text) return;
    try {
      const created = await createClient.mutateAsync({
        data: { nombre: text },
      });
      setSelectedClientResourceId(created.id);
      setSelectedClientResource(created);
      setClientSearch('');
      toast.success(`"${text}" creado`);
    } catch {
      toast.error('No se pudo crear');
    }
  }

  async function handleCustomFormCreate() {
    const requiredMissing = customFields.filter(
      (f) => f.required && !customFieldValues[f.key]?.trim()
    );
    if (requiredMissing.length > 0) {
      toast.error(`Falta: ${requiredMissing.map((f) => f.label).join(', ')}`);
      return;
    }
    const cleaned = Object.fromEntries(
      Object.entries(customFieldValues).filter(([, v]) => v?.trim())
    );
    // `nombre` is the key the backend looks for to create/link the real
    // client user; without it the resource stays unowned.
    if (!hasNameField && walkInClientName.trim()) {
      cleaned.nombre = walkInClientName.trim();
    }
    if (Object.keys(cleaned).length === 0) {
      toast.error('Llena al menos un campo');
      return;
    }
    // Billing snapshot capture (Fase D) — only ship when dirty and
    // valid. If the cashier touched something but checksum fails we
    // bail so they can fix it instead of silently dropping the data.
    const shouldShipBilling = isBillingProfileDirty(billingProfile);
    if (shouldShipBilling && !isBillingProfileValid(billingProfile)) {
      toast.error('Revisa los datos de facturación');
      return;
    }

    try {
      const created = await createClient.mutateAsync({
        data: cleaned,
        billingProfile: shouldShipBilling
          ? {
              docType: billingProfile.docType,
              docNumber: billingProfile.docNumber.trim() || undefined,
              legalName: billingProfile.legalName.trim() || undefined,
              email: billingProfile.email.trim() || undefined,
              address: billingProfile.address.trim() || undefined,
              phone: billingProfile.phone.trim() || undefined,
            }
          : undefined,
      });
      setSelectedClientResourceId(created.id);
      setSelectedClientResource(created);
      setShowCustomForm(false);
      setCustomFieldValues({});
      setBillingProfile(EMPTY_BILLING_PROFILE);
      setWalkInClientName('');
      setClientSearch('');
      toast.success('Registro creado');
    } catch {
      toast.error('No se pudo crear');
    }
  }

  const services = servicesData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const team = teamData?.data ?? [];

  function handleReset() {
    setLineItems([]);
    setProductLines([]);
    setWalkInClientName('');
    setClientSearch('');
    setSelectedClientResourceId(null);
    setSelectedClientResource(null);
    setAttendedBy('');
    setPaymentMethod('cash');
    setPaymentBank(null);
    setPaymentTiming('now');
    setNotes('');
    setShowCustomForm(false);
    setCustomFieldValues({});
    setBillingProfile(EMPTY_BILLING_PROFILE);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleAddLineItem(svc: Service) {
    // Same service picked again → bump qty on the existing line, no
    // variant resolution needed.
    const existing = lineItems.find((it) => it.service.id === svc.id);
    if (existing) {
      setLineItems((prev) =>
        prev.map((it) => (it.service.id === svc.id ? { ...it, qty: it.qty + 1 } : it)),
      );
      return;
    }

    // Optimistic insert with the service base price so the row appears
    // immediately while we resolve the variant in the background.
    setLineItems((prev) => [
      ...prev,
      {
        service: svc,
        qty: 1,
        unitPrice: svc.price,
        variantId: null,
        variantLabel: null,
        availableVariants: null,
      },
    ]);
    pushRecentServiceId(svc.id);
    setRecentServiceIds((prev) => [svc.id, ...prev.filter((id) => id !== svc.id)].slice(0, 5));

    // Resolve in parallel: the suggester returns a variant matching the
    // client's recurso (car wash → vehicle type), while the variants
    // list is the fallback picker for cases where no auto-match exists.
    const variants = await fetchVariantsForService(svc.id);

    if (variants.length === 0) {
      // No variants registered → keep the base price the line already
      // landed with. Mark available as [] so the picker doesn't keep
      // showing the "resolviendo…" hint.
      setLineItems((prev) =>
        prev.map((it) =>
          it.service.id === svc.id ? { ...it, availableVariants: [] } : it,
        ),
      );
      return;
    }

    let suggested: ServiceVariantSlim | null = null;
    if (selectedClientResourceId) {
      suggested = await fetchSuggestedVariant(svc.id, selectedClientResourceId);
    }

    setLineItems((prev) =>
      prev.map((it) => {
        if (it.service.id !== svc.id) return it;
        if (suggested) {
          return {
            ...it,
            variantId: suggested.id,
            variantLabel: suggested.label,
            unitPrice: suggested.price,
            availableVariants: variants,
          };
        }
        // No suggestion — leave the line awaiting cashier choice but
        // surface the picker so the variants list is one click away.
        return { ...it, availableVariants: variants };
      }),
    );
  }

  function handleAddProductLine(productId: string) {
    const product = sellableProducts.find((p) => p.id === productId);
    if (!product) return;

    setProductLines((prev) => {
      const existing = prev.find((it) => it.product.id === productId);
      if (existing) {
        return prev.map((it) =>
          it.product.id === productId ? { ...it, qty: it.qty + 1 } : it,
        );
      }
      return [...prev, { product, qty: 1, unitPrice: product.price }];
    });
  }

  function handleUpdateProductQty(productId: string, qty: number) {
    const next = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    setProductLines((prev) =>
      prev.map((it) => (it.product.id === productId ? { ...it, qty: next } : it)),
    );
  }

  function handleRemoveProductLine(productId: string) {
    setProductLines((prev) => prev.filter((it) => it.product.id !== productId));
  }

  function handleRemoveLineItem(serviceId: string) {
    setLineItems((prev) => prev.filter((it) => it.service.id !== serviceId));
  }

  function handleUpdateLineItem(serviceId: string, patch: Partial<Omit<LineItem, 'service'>>) {
    setLineItems((prev) =>
      prev.map((it) => (it.service.id === serviceId ? { ...it, ...patch } : it)),
    );
  }

  function handlePickVariant(serviceId: string, variant: ServiceVariantSlim) {
    setLineItems((prev) =>
      prev.map((it) =>
        it.service.id === serviceId
          ? {
              ...it,
              variantId: variant.id,
              variantLabel: variant.label,
              unitPrice: variant.price,
            }
          : it,
      ),
    );
  }

  function handleSubmit() {
    if (!selectedClientResourceId || !effectiveAttendedBy) return;
    if (lineItems.length === 0 && productLines.length === 0) return;
    if (paymentTiming === 'now' && paymentMethod === 'transfer' && !paymentBank) {
      toast.error('Selecciona el banco emisor');
      return;
    }
    // Any line with variants registered must have a variant picked.
    // Lines whose service has no variants pass through with base price.
    const missingVariant = lineItems.find(
      (it) => Array.isArray(it.availableVariants) && it.availableVariants.length > 0 && !it.variantId,
    );
    if (missingVariant) {
      toast.error(`Elige la variante para "${missingVariant.service.name}"`);
      return;
    }

    const payNow = paymentTiming === 'now';

    createMutation.mutate(
      {
        clientResourceId: selectedClientResourceId,
        attendedBy: effectiveAttendedBy,
        items: [
          ...lineItems.map((it) => ({
            itemType: 'service_variant' as const,
            serviceId: it.service.id,
            variantId: it.variantId,
            label: it.variantLabel
              ? `${it.service.name} · ${it.variantLabel}`
              : it.service.name,
            qty: it.qty,
            unitPrice: it.unitPrice,
          })),
          ...productLines.map((it) => ({
            itemType: 'product' as const,
            productId: it.product.id,
            label: it.product.name,
            qty: it.qty,
            unitPrice: it.unitPrice,
          })),
        ],
        paymentMethod: payNow ? paymentMethod : null,
        paymentBank: payNow && paymentMethod === 'transfer' ? paymentBank : null,
        paymentStatus: payNow ? 'paid' : 'unpaid',
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          const noun = lineItems.length === 0 ? 'Venta registrada' : 'Servicio registrado';
          toast.success(payNow ? `${noun} y cobrada` : `${noun} · pago pendiente`);
          handleClose();
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Error al registrar servicio')),
      },
    );
  }

  const canSubmit =
    (lineItems.length > 0 || productLines.length > 0) &&
    !!selectedClientResourceId &&
    !!effectiveAttendedBy &&
    total > 0 &&
    // Every line with variants registered must have one picked. Lines
    // whose service has no variants pass through.
    lineItems.every(
      (it) =>
        !Array.isArray(it.availableVariants) ||
        it.availableVariants.length === 0 ||
        !!it.variantId,
    ) &&
    (paymentTiming === 'later' || paymentMethod !== 'transfer' || !!paymentBank);

  const body = (
    <>
      <div className="flex flex-col gap-5">
          {/* Multi-service line items. Cliente lives above this block via
              CSS order — the car-wash flow needs vehicle type captured
              before service prices can resolve to the right variant. */}
          <div className="order-2">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label className="block text-sm font-medium">
                Servicios{' '}
                {lineItems.length > 0 && (
                  <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                    ({lineItems.length})
                  </span>
                )}
              </label>
              {lineItems.length > 0 && (
                <span
                  className="font-mono text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatMoney(servicesTotal)}
                </span>
              )}
            </div>

            {selectedClientResourceId ? (
              <ServiceCombobox
                services={services}
                selected={null}
                recentIds={recentServiceIds}
                isLoading={servicesLoading}
                onSelect={handleAddLineItem}
                placeholder={
                  lineItems.length === 0
                    ? 'Selecciona un servicio…'
                    : 'Agregar otro servicio…'
                }
              />
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-app)] px-3 py-3 text-[12.5px] text-[var(--fg-muted)]">
                Selecciona o crea un cliente arriba para empezar a agregar
                servicios. El precio se ajusta al recurso elegido (por ejemplo,
                según el tipo de vehículo).
              </div>
            )}

            {lineItems.length > 0 && (
              <ul className="mt-2 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {lineItems.map((it) => {
                  // Needs an explicit variant pick when the service has
                  // variants registered but auto-suggest didn't land one.
                  const variantsAvailable = Array.isArray(it.availableVariants) ? it.availableVariants : null;
                  const needsVariantPick =
                    variantsAvailable && variantsAvailable.length > 0 && !it.variantId;
                  return (
                    <li
                      key={it.service.id}
                      className={cn(
                        'rounded-md px-2 py-1.5',
                        needsVariantPick && 'bg-[var(--warning-50)]',
                      )}
                    >
                      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--fg-strong)]">
                            {it.service.name}
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
                          onChange={(e) =>
                            handleUpdateLineItem(it.service.id, {
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
                          onChange={(e) =>
                            handleUpdateLineItem(it.service.id, {
                              unitPrice: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-8 w-24 text-right font-mono tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
                          aria-label="Precio unitario"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(it.service.id)}
                          className="rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--danger-50)] hover:text-[var(--danger-600)] cursor-pointer"
                          aria-label={`Quitar ${it.service.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Inline variant picker — fires when the
                          suggestor couldn't pick one for the client's
                          recurso, so the cashier still gets a one-tap
                          path to the right price. */}
                      {needsVariantPick && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                            Elige variante:
                          </span>
                          {variantsAvailable.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handlePickVariant(it.service.id, v)}
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

          {/* Counter sale: products straight off the shelf. A ticket may
              be products only (an aceite sold without washing anything),
              so this block never depends on a service being picked. */}
          <div className="order-2">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label className="block text-sm font-medium">
                Productos{' '}
                {productLines.length > 0 && (
                  <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                    ({productLines.length})
                  </span>
                )}
              </label>
              {productLines.length > 0 && (
                <span
                  className="font-mono text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatMoney(productsTotal)}
                </span>
              )}
            </div>

            {selectedClientResourceId ? (
              <Select value="" onValueChange={handleAddProductLine}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      productLines.length === 0 ? 'Agregar producto…' : 'Agregar otro producto…'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sellableProducts.length === 0 ? (
                    <div className="px-2 py-3 text-[12.5px] text-[var(--fg-muted)]">
                      No hay productos vendibles en el inventario.
                    </div>
                  ) : (
                    sellableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatMoney(p.price)}
                        {p.stock ? ` · ${p.stock.onHand} en stock` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-app)] px-3 py-3 text-[12.5px] text-[var(--fg-muted)]">
                Selecciona o crea un cliente arriba para vender productos.
              </div>
            )}

            {productLines.length > 0 && (
              <ul className="mt-2 space-y-2">
                {productLines.map((line) => {
                  const onHand = line.product.stock?.onHand ?? null;
                  const short = onHand !== null && line.qty > onHand;

                  return (
                    <li
                      key={line.product.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-[var(--fg-strong)]">
                            {line.product.name}
                          </p>
                          {onHand !== null && (
                            <p
                              className={cn(
                                'text-[12px]',
                                short ? 'text-[var(--danger-700)]' : 'text-[var(--fg-muted)]',
                              )}
                            >
                              {short
                                ? `Solo ${onHand} en stock — se registrará igual y el inventario quedará en negativo`
                                : `${onHand} en stock`}
                            </p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) =>
                            handleUpdateProductQty(line.product.id, Number(e.target.value))
                          }
                          className="h-9 w-16 text-center"
                          aria-label={`Cantidad de ${line.product.name}`}
                        />
                        <span
                          className="w-20 shrink-0 text-right font-mono text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {formatMoney(line.unitPrice * line.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProductLine(line.product.id)}
                          className="shrink-0 rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger-700)]"
                          aria-label={`Quitar ${line.product.name}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Client resource search — pinned to the top (order-1) so the
              cashier captures vehicle type before resolving service
              variants. */}
          <div className="order-1">
            <label className="mb-2 block text-sm font-medium">Cliente / Recurso</label>
            {selectedClientResource && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-2">
                <Check className="h-4 w-4 shrink-0 text-[var(--brand-600)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--brand-700)]">
                    {selectedClientResource.label ||
                      selectedClientResource.plate ||
                      selectedClientResource.client?.name ||
                      'Sin identificar'}
                  </p>
                  {(selectedClientResource.brand ||
                    selectedClientResource.model ||
                    selectedClientResource.color ||
                    selectedClientResource.client?.email) && (
                    <p className="truncate text-xs text-[var(--brand-700)]/70">
                      {[
                        selectedClientResource.brand,
                        selectedClientResource.model,
                        selectedClientResource.color,
                      ]
                        .filter(Boolean)
                        .join(' · ') || selectedClientResource.client?.email}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientResourceId(null);
                    setSelectedClientResource(null);
                  }}
                  className="rounded-md p-1 text-[var(--brand-700)] transition-colors hover:bg-[var(--brand-100)]"
                  aria-label="Quitar selección"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={(() => {
                  // Pull the tenant's first 2 custom-field labels
                  // (placa for car wash, nombre_paciente for medical,
                  // etc.) so the hint matches what the tenant actually
                  // captures, then tack on the always-available name +
                  // email fallbacks.
                  const customLabels = customFields
                    .slice(0, 2)
                    .map((f) => f.label.toLowerCase())
                    .filter(Boolean);
                  const hints = [...customLabels, 'nombre', 'correo'];
                  // Dedupe in case the tenant added "Nombre" as a custom
                  // field so the placeholder doesn't read "nombre, nombre".
                  const unique = Array.from(new Set(hints));
                  return `Buscar por ${unique.join(', ')}…`;
                })()}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
            {clientsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {clients.map((cr) => (
                    <button
                      key={cr.id}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all',
                        selectedClientResourceId === cr.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]/50 ring-1 ring-[var(--color-primary)]/20'
                          : 'hover:bg-zinc-50'
                      )}
                      onClick={() => {
                        setSelectedClientResourceId(cr.id);
                        setSelectedClientResource(cr);
                      }}
                    >
                      {selectedClientResourceId === cr.id && (
                        <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {cr.label || cr.plate || cr.client?.name || 'Sin identificar'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[cr.brand, cr.model, cr.color].filter(Boolean).join(' - ') ||
                            cr.client?.email ||
                            ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Pinned below the scroll box, not inside it: an action that
                    sits after N vehicles is an action nobody scrolls to. */}
                {!showCustomForm && (hasCustomFields ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomForm(true);
                      const seedKey = customFields[0]?.key;
                      if (seedKey && clientSearch.trim()) {
                        setCustomFieldValues({ [seedKey]: clientSearch.trim() });
                      }
                    }}
                    className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] p-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-[var(--brand-500)]" />
                    <span className="text-sm">Crear nuevo registro</span>
                  </button>
                ) : (
                  clientSearch.trim() && (
                    <button
                      type="button"
                      onClick={handleQuickCreateClient}
                      disabled={createClient.isPending}
                      className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] p-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60"
                    >
                      {createClient.isPending ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--fg-muted)]" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-[var(--brand-500)]" />
                      )}
                      <span className="min-w-0 truncate text-sm">
                        Crear{' '}
                        <span className="font-semibold text-[var(--brand-700)]">
                          &quot;{clientSearch.trim()}&quot;
                        </span>{' '}
                        y usar
                      </span>
                    </button>
                  )
                ))}
              </>
            )}

            {showCustomForm && hasCustomFields && (
              <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Crear nuevo registro
                </p>
                {!hasNameField && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--fg)]">
                      Nombre del cliente
                      <span className="ml-1 font-normal text-[var(--fg-muted)]">(opcional)</span>
                    </label>
                    <Input
                      type="text"
                      value={walkInClientName}
                      placeholder="Ej. Vanessa Paspuel"
                      onChange={(e) =>
                        setWalkInClientName(applyCapitalization(e.target.value, 'capitalize'))
                      }
                    />
                  </div>
                )}
                {customFields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-[var(--fg)]">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-[var(--brand-600)]">*</span>}
                    </label>
                    {f.type === 'select' ? (
                      <Select
                        value={customFieldValues[f.key] ?? ''}
                        onValueChange={(v) => setCustomFieldValues((s) => ({ ...s, [f.key]: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Seleccionar ${f.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : f.type === 'textarea' ? (
                      <Textarea
                        rows={2}
                        value={customFieldValues[f.key] ?? ''}
                        onChange={(e) =>
                          setCustomFieldValues((s) => ({
                            ...s,
                            [f.key]: applyCapitalization(e.target.value, f.capitalize),
                          }))
                        }
                      />
                    ) : (
                      <Input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={customFieldValues[f.key] ?? ''}
                        onChange={(e) =>
                          setCustomFieldValues((s) => ({
                            ...s,
                            [f.key]: applyCapitalization(e.target.value, f.capitalize),
                          }))
                        }
                      />
                    )}
                  </div>
                ))}

                {/* Optional billing snapshot — captured alongside the
                    custom-field data so SRI factura tiene la identidad
                    lista desde el primer registro. (Fase D) */}
                <BillingProfileForm
                  value={billingProfile}
                  onChange={setBillingProfile}
                  compact
                />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCustomFormCreate}
                    disabled={createClient.isPending}
                  >
                    {createClient.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Crear y usar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomFieldValues({});
                      setBillingProfile(EMPTY_BILLING_PROFILE);
                      setWalkInClientName('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Employee select */}
          <div className="order-3">
            <label className="mb-1.5 block text-sm font-medium">Empleado</label>
            <Select
              value={effectiveAttendedBy}
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
            {lockedToSelf && (
              <p className="mt-1 text-[11.5px] text-[var(--fg-muted)]">
                El servicio se registra a tu nombre.
              </p>
            )}
          </div>

          {/* Timing toggle — cobrar ahora vs cobrar al retirar.
              Default "ahora" preserves the legacy flow; "al retirar"
              is the car-wash pickup case where the cashier registers
              the service first and collects when the customer recoge
              el vehículo. */}
          <div className="order-4">
            <label className="mb-2 block text-sm font-medium">Cuándo se cobra</label>
            <div className="grid grid-cols-2 gap-2">
              {(['now', 'later'] as const).map((mode) => {
                const active = paymentTiming === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentTiming(mode)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                    )}
                  >
                    <p className={cn('text-[13.5px] font-semibold', active ? 'text-[var(--brand-700)]' : 'text-[var(--fg-strong)]')}>
                      {mode === 'now' ? 'Cobrar ahora' : 'Cobrar al retirar'}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)]">
                      {mode === 'now'
                        ? 'Captura método ahora mismo'
                        : 'Marcar pago pendiente'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment method radio-style buttons — only when cobrando ahora. */}
          <div className="order-5">
          {paymentTiming === 'later' ? (
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--warning-50)] p-3 text-[12.5px] text-[var(--warning-800)]">
              Pago pendiente al entregar. Podrás registrar el método desde el listado
              cuando el cliente cobre.
            </div>
          ) : (
          <div>
            <label className="mb-2 block text-sm font-medium">Método de pago</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = paymentMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                        : 'border-[var(--border)] text-[var(--fg-strong)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                    )}
                    onClick={() => setPaymentMethod(opt.value)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bank picker — only renders for transferencia. Same chip
                pattern as the reservation payment modal so the cashier
                recognises the row across screens. */}
            {paymentMethod === 'transfer' && (
              <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Banco emisor
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ECUADOR_BANKS.map((b) => {
                    const active = paymentBank === b.slug;
                    return (
                      <button
                        key={b.slug}
                        type="button"
                        onClick={() => setPaymentBank(b.slug)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
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
          </div>

          {/* Notes */}
          <div className="order-6">
            <label className="mb-1.5 block text-sm font-medium">Notas (opcional)</label>
            <Textarea
              placeholder="Observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
    </>
  );

  const footerButtons = (
    <>
      {/* The amount to charge is the one number the cashier reads out
          loud, so it sits next to the action instead of being inferred
          from two section subtotals. */}
      <div className="flex w-full items-baseline justify-between gap-2 sm:mr-auto sm:w-auto sm:justify-start">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Total
        </span>
        <span
          className="font-mono text-[19px] font-bold tabular-nums text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatMoney(total)}
        </span>
      </div>
      <Button variant="outline" onClick={handleClose}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
        Registrar Servicio
      </Button>
    </>
  );

  // Embedded variant — used in the master-detail layout on desktop.
  // No portal, no backdrop, no modal trap; the daily log stays visible
  // and interactive to the left of the panel. Slides in from the right
  // via animate-in / slide-in-from-right-3 so the layout shift reads as
  // intentional rather than a pop.
  if (embedded) {
    if (!open) return null;
    return (
      <div
        className={cn(
          'flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]',
          'animate-in fade-in slide-in-from-right-3 duration-200 ease-out',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[var(--fg-strong)]">
              Nuevo servicio
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">
              Registrar un servicio realizado
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 shrink-0 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{body}</div>
        <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-app)] px-5 py-3">
          {footerButtons}
        </footer>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo Servicio</DialogTitle>
          <DialogDescription>Registrar un servicio realizado</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{footerButtons}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
