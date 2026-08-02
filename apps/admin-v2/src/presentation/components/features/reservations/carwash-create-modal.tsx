'use client';

import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Search,
  Check,
  Plus,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
import { Calendar } from '@/presentation/components/ui/calendar';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { useServices } from '@/presentation/hooks/use-services';
import {
  useAvailableSlots,
  useCreateReservation,
} from '@/presentation/hooks/use-reservations';
import { useClients, useCreateClient } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useTeam } from '@/presentation/hooks/use-team';
import { ServiceCombobox } from '@/presentation/components/features/service-logs/service-combobox';
import type { Service } from '@/domain/entities/service';
import type { ClientResource } from '@/domain/entities/client-resource';
import type { BusinessType, CustomField } from '@/domain/entities/tenant';

interface CarwashReservationModalProps {
  open: boolean;
  onClose: () => void;
}

const STEP_TITLES = ['Cliente / Recurso', 'Servicios', 'Fecha y Hora', 'Confirmar'];

// Same default custom fields per business type as new-service-modal.tsx.
// Not exported from there, so duplicated here — this modal only ever
// renders for car_wash tenants but keeps the full map for parity.
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

interface VariantOption {
  id: string;
  label: string;
  price: number;
  durationMin: number;
}

interface LineItem {
  service: Service;
  qty: number;
  unitPrice: number;
  /** Picked variant — required before the wizard can advance past the
      Servicios step (car_wash services are always variant-priced by
      vehicle type). */
  variantId: string | null;
  variantLabel: string | null;
  durationMin: number;
  /** Variants available for this service. Empty array = service has no
      variants registered. `null` while we're still fetching. */
  availableVariants: VariantOption[] | null;
}

const DEFAULT_DURATION_MIN = 30;

const money = (n: number) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(n);

async function fetchVariantsForService(serviceId: string): Promise<VariantOption[]> {
  // Direct fetch via the shared axios client — same pattern as
  // new-service-modal's fetchVariantsForService, but keeps durationMin
  // instead of dropping it, since the wizard needs it for slot search.
  const { default: api } = await import('@/infrastructure/api/client');
  const { data: res } = await api.get(`/services/${serviceId}/variants`);
  const raw = (res.data ?? []) as Array<Record<string, unknown>>;
  return raw
    .filter((v) => v.is_active !== false)
    .map((v) => ({
      id: String(v.id),
      label: String(v.label ?? ''),
      price: Number(v.price ?? 0),
      durationMin: Number(v.duration_min ?? DEFAULT_DURATION_MIN),
    }));
}

async function fetchSuggestedVariant(
  serviceId: string,
  resourceId: string,
): Promise<VariantOption | null> {
  const { default: api } = await import('@/infrastructure/api/client');
  try {
    const { data: res } = await api.get(`/public/services/${serviceId}/suggested-variant`, {
      params: { resource_id: resourceId },
    });
    const d = res.data;
    if (!d || !d.variant_id) return null;
    return {
      id: String(d.variant_id),
      label: String(d.label ?? ''),
      price: Number(d.price ?? 0),
      durationMin: Number(d.duration_min ?? DEFAULT_DURATION_MIN),
    };
  } catch {
    return null;
  }
}

function applyCapitalization(
  value: string,
  mode?: 'none' | 'uppercase' | 'capitalize' | 'lowercase',
): string {
  if (mode === 'uppercase') return value.toUpperCase();
  if (mode === 'lowercase') return value.toLowerCase();
  if (mode === 'capitalize') {
    return value.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return value;
}

export function CarwashReservationModal({ open, onClose }: CarwashReservationModalProps) {
  const [step, setStep] = useState(0);

  // Step 0 — Cliente / Recurso
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientResourceId, setSelectedClientResourceId] = useState<string | null>(null);
  const [selectedClientResource, setSelectedClientResource] = useState<ClientResource | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Step 1 — Servicios
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Step 2 — Fecha y Hora
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Step 3 — Confirmar
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Re-resolve variants when the client/recurso changes — a Lavada
  // premium picked while the Kia SUV was selected has to re-price (or
  // land in "needs pick" state) when staff flips to a sedán. Mirrors
  // new-service-modal's re-resolve effect (lines 209-260).
  useEffect(() => {
    if (!selectedClientResourceId) return;
    if (lineItems.length === 0) return;
    let cancelled = false;
    const resourceId = selectedClientResourceId;

    (async () => {
      const updates = await Promise.all(
        lineItems.map(async (it) => {
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
                durationMin: suggested.durationMin,
              } as Partial<LineItem>,
            };
          }
          return {
            id: it.service.id,
            patch: { variantId: null, variantLabel: null } as Partial<LineItem>,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientResourceId]);

  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const { data: clientsData, isLoading: clientsLoading } = useClients(1, clientSearch || undefined);
  const { data: settings } = useSettings();
  const { data: teamData } = useTeam({ excludeRole: 'client' as const });
  const createClient = useCreateClient();
  const createMutation = useCreateReservation();

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;
  const totalDurationMin = useMemo(
    () => lineItems.reduce((sum, l) => sum + l.durationMin * l.qty, 0),
    [lineItems],
  );

  // A slot picked in step 2 is only valid for the duration that was in
  // effect when it was fetched. If the user goes back to step 1 and adds
  // a service or bumps a qty, totalDurationMin changes and the previously
  // selected slot may no longer fit — clear it so the step 2 gate forces
  // a fresh pick. Harmless on mount since no slot is selected yet.
  useEffect(() => {
    setSelectedSlot(null);
  }, [totalDurationMin]);

  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    dateStr,
    lineItems[0]?.service.id,
    totalDurationMin,
  );

  const services = servicesData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const team = teamData?.data ?? [];
  const slots = slotsData ?? [];

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

  const total = lineItems.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);

  function handleClose() {
    setStep(0);
    setClientSearch('');
    setSelectedClientResourceId(null);
    setSelectedClientResource(null);
    setShowCustomForm(false);
    setCustomFieldValues({});
    setLineItems([]);
    setSelectedDate(new Date());
    setSelectedSlot(null);
    setAssignedTo('');
    setNotes('');
    onClose();
  }

  async function handleQuickCreateClient() {
    const text = clientSearch.trim();
    if (!text) return;
    try {
      const created = await createClient.mutateAsync({ data: { nombre: text } });
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
      (f) => f.required && !customFieldValues[f.key]?.trim(),
    );
    if (requiredMissing.length > 0) {
      toast.error(`Falta: ${requiredMissing.map((f) => f.label).join(', ')}`);
      return;
    }
    const cleaned = Object.fromEntries(
      Object.entries(customFieldValues).filter(([, v]) => v?.trim()),
    );
    if (Object.keys(cleaned).length === 0) {
      toast.error('Llena al menos un campo');
      return;
    }

    try {
      const created = await createClient.mutateAsync({ data: cleaned });
      setSelectedClientResourceId(created.id);
      setSelectedClientResource(created);
      setShowCustomForm(false);
      setCustomFieldValues({});
      setClientSearch('');
      toast.success('Registro creado');
    } catch {
      toast.error('No se pudo crear');
    }
  }

  async function handleAddLineItem(svc: Service) {
    const existing = lineItems.find((it) => it.service.id === svc.id);
    if (existing) {
      setLineItems((prev) =>
        prev.map((it) => (it.service.id === svc.id ? { ...it, qty: it.qty + 1 } : it)),
      );
      return;
    }

    // Optimistic insert with the service base price/duration so the row
    // appears immediately while we resolve the variant in the background.
    setLineItems((prev) => [
      ...prev,
      {
        service: svc,
        qty: 1,
        unitPrice: svc.price,
        variantId: null,
        variantLabel: null,
        durationMin: DEFAULT_DURATION_MIN,
        availableVariants: null,
      },
    ]);

    const variants = await fetchVariantsForService(svc.id);

    if (variants.length === 0) {
      // No variants configured for this service — an empty-variant line
      // can never satisfy the step-1 gate (variantId stays null forever),
      // so drop the optimistic line instead of leaving a dead-end row.
      setLineItems((prev) => prev.filter((it) => it.service.id !== svc.id));
      toast.error('Este servicio no tiene variantes configuradas.');
      return;
    }

    let suggested: VariantOption | null = null;
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
            durationMin: suggested.durationMin,
            availableVariants: variants,
          };
        }
        return { ...it, availableVariants: variants };
      }),
    );
  }

  function handleRemoveLineItem(serviceId: string) {
    setLineItems((prev) => prev.filter((it) => it.service.id !== serviceId));
  }

  function handleUpdateLineItemQty(serviceId: string, qty: number) {
    const clamped = Math.min(10, Math.max(1, Math.floor(qty || 1)));
    setLineItems((prev) =>
      prev.map((it) => (it.service.id === serviceId ? { ...it, qty: clamped } : it)),
    );
  }

  function handlePickVariant(serviceId: string, variant: VariantOption) {
    setLineItems((prev) =>
      prev.map((it) =>
        it.service.id === serviceId
          ? {
              ...it,
              variantId: variant.id,
              variantLabel: variant.label,
              unitPrice: variant.price,
              durationMin: variant.durationMin,
            }
          : it,
      ),
    );
  }

  function handleSubmit() {
    if (!selectedClientResourceId || !selectedSlot || lineItems.length === 0) return;

    createMutation.mutate(
      {
        clientResourceId: selectedClientResourceId,
        serviceId: lineItems[0].service.id,
        scheduledAt: selectedSlot,
        assignedTo: assignedTo || undefined,
        notes: notes || undefined,
        items: lineItems.map((l) => ({ serviceVariantId: l.variantId!, qty: l.qty })),
      },
      {
        onSuccess: () => {
          toast.success('Reserva creada');
          handleClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'Error al crear la reserva');
        },
      },
    );
  }

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return !!selectedClientResourceId;
      case 1:
        return lineItems.length >= 1 && lineItems.every((l) => !!l.variantId);
      case 2:
        return !!selectedSlot;
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, selectedClientResourceId, lineItems, selectedSlot]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogDescription>
            Paso {step + 1} de 4 &mdash; {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full',
                i <= step ? 'bg-[var(--color-primary)]' : 'bg-zinc-200',
              )}
            />
          ))}
        </div>

        {/* Step 0: Cliente / Recurso */}
        {step === 0 && (
          <div className="space-y-4">
            {selectedClientResource && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-2">
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={(() => {
                  const customLabels = customFields
                    .slice(0, 2)
                    .map((f) => f.label.toLowerCase())
                    .filter(Boolean);
                  const hints = [...customLabels, 'nombre', 'correo'];
                  const unique = Array.from(new Set(hints));
                  return `Buscar por ${unique.join(', ')}…`;
                })()}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>

            {clientsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {clients.map((cr) => (
                  <button
                    key={cr.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all',
                      selectedClientResourceId === cr.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]/50 ring-1 ring-[var(--color-primary)]/20'
                        : 'hover:bg-zinc-50',
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

                {!showCustomForm &&
                  (hasCustomFields ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomForm(true);
                        const seedKey = customFields[0]?.key;
                        if (seedKey && clientSearch.trim()) {
                          setCustomFieldValues({ [seedKey]: clientSearch.trim() });
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] p-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
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
                        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] p-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60"
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
              </div>
            )}

            {showCustomForm && hasCustomFields && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Crear nuevo registro
                </p>
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

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCustomFormCreate} disabled={createClient.isPending}>
                    {createClient.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Crear y usar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomFieldValues({});
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Servicios */}
        {step === 1 && (
          <div className="space-y-4">
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
                  {money(total)}
                </span>
              )}
            </div>

            <ServiceCombobox
              services={services}
              selected={null}
              isLoading={servicesLoading}
              onSelect={handleAddLineItem}
              placeholder={
                lineItems.length === 0 ? 'Selecciona un servicio…' : 'Agregar otro servicio…'
              }
            />

            {lineItems.length > 0 && (
              <ul className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {lineItems.map((it) => {
                  const needsVariantPick = !it.variantId;
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
                              {it.variantLabel} · {it.durationMin} min
                            </p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          step="1"
                          value={it.qty}
                          onChange={(e) =>
                            handleUpdateLineItemQty(it.service.id, Number(e.target.value) || 1)
                          }
                          className="h-8 w-16 text-center"
                          aria-label="Cantidad"
                        />
                        <span
                          className="font-mono text-[12.5px] tabular-nums text-[var(--fg-secondary)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {money(it.unitPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(it.service.id)}
                          className="rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--danger-50)] hover:text-[var(--danger-600)] cursor-pointer"
                          aria-label={`Quitar ${it.service.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Variant picker — always available so staff can
                          override the auto-suggested match, and required
                          when it hasn't resolved one yet. */}
                      {it.availableVariants === null ? (
                        <p className="mt-1.5 text-[11.5px] text-[var(--fg-muted)]">
                          Resolviendo variante…
                        </p>
                      ) : it.availableVariants.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {needsVariantPick && (
                            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                              Elige variante:
                            </span>
                          )}
                          {it.availableVariants.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handlePickVariant(it.service.id, v)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors cursor-pointer',
                                it.variantId === v.id
                                  ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                                  : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg-strong)] hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)]',
                              )}
                            >
                              <span>{v.label}</span>
                              <span
                                className="font-mono text-[11px] tabular-nums text-[var(--fg-secondary)]"
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {money(v.price)} · {v.durationMin}min
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Step 2: Fecha y Hora */}
        {step === 2 && (
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d ?? undefined);
                setSelectedSlot(null);
              }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />

            <div>
              <p className="mb-2 text-sm font-medium">Horarios disponibles</p>
              {slotsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-20 rounded-md" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay horarios disponibles para esta fecha
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const slotStr =
                      typeof slot.start === 'string'
                        ? slot.start
                        : format(new Date(slot.start), 'yyyy-MM-dd HH:mm:ss');
                    const isSelected = selectedSlot === slotStr;
                    return (
                      <Button
                        key={slotStr}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className="h-8"
                        onClick={() => setSelectedSlot(slotStr)}
                      >
                        {format(new Date(slot.start), 'HH:mm')}
                        {slot.available > 0 && (
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            {slot.available}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirmar */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Asignar empleado (opcional)
              </label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
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

            <div>
              <label className="mb-1.5 block text-sm font-medium">Notas (opcional)</label>
              <Textarea
                placeholder="Instrucciones especiales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-zinc-50 p-4 text-sm">
              <h4 className="mb-2 font-semibold">Resumen</h4>
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Cliente / Recurso:</span>{' '}
                  {selectedClientResource?.label ||
                    selectedClientResource?.plate ||
                    selectedClientResource?.client?.name ||
                    '-'}
                </p>
                <p>
                  <span className="font-medium text-foreground">Fecha:</span>{' '}
                  {selectedSlot
                    ? format(new Date(selectedSlot), "d 'de' MMMM yyyy, HH:mm", { locale: es })
                    : '-'}
                </p>
                <div className="space-y-0.5 pt-1">
                  {lineItems.map((it) => (
                    <p key={it.service.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {it.service.name}
                        {it.variantLabel ? ` · ${it.variantLabel}` : ''} × {it.qty}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-foreground">
                        {money(it.unitPrice * it.qty)}
                      </span>
                    </p>
                  ))}
                </div>
                <p className="flex items-center justify-between gap-2 border-t pt-1.5 font-medium text-foreground">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{money(total)}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Atras
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              Crear Reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
