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
import { useServices } from '@/presentation/hooks/use-services';
import { useClients, useCreateClient } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useTeam } from '@/presentation/hooks/use-team';
import { useCreateServiceLog } from '@/presentation/hooks/use-service-logs';
import { ServiceCombobox } from '@/presentation/components/features/service-logs/service-combobox';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import type { Service } from '@/domain/entities/service';
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

export function NewServiceModal({ open, onClose, embedded = false }: NewServiceModalProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientResourceId, setSelectedClientResourceId] = useState<string | null>(null);
  const [selectedClientResource, setSelectedClientResource] = useState<ClientResource | null>(null);
  const [attendedBy, setAttendedBy] = useState('');
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentBank, setPaymentBank] = useState<string | null>(null);
  const [paymentTiming, setPaymentTiming] = useState<'now' | 'later'>('now');
  const [notes, setNotes] = useState('');
  const [recentServiceIds, setRecentServiceIds] = useState<string[]>([]);

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

  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const { data: clientsData, isLoading: clientsLoading } = useClients(1, clientSearch || undefined);
  const { data: settings } = useSettings();
  const { data: teamData } = useTeam({ excludeRole: 'client' as const });
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

  const services = servicesData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const team = teamData?.data ?? [];

  function handleReset() {
    setSelectedService(null);
    setClientSearch('');
    setSelectedClientResourceId(null);
    setSelectedClientResource(null);
    setAttendedBy('');
    setPrice('');
    setPaymentMethod('cash');
    setPaymentBank(null);
    setPaymentTiming('now');
    setNotes('');
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  function handleSelectService(svc: Service) {
    setSelectedService(svc);
    setPrice(String(svc.price));
    pushRecentServiceId(svc.id);
    setRecentServiceIds((prev) => [svc.id, ...prev.filter((id) => id !== svc.id)].slice(0, 5));
  }

  function handleSubmit() {
    if (!selectedClientResourceId || !selectedService || !attendedBy || !price) return;
    if (paymentTiming === 'now' && paymentMethod === 'transfer' && !paymentBank) {
      toast.error('Selecciona el banco emisor');
      return;
    }

    const payNow = paymentTiming === 'now';

    createMutation.mutate(
      {
        clientResourceId: selectedClientResourceId,
        serviceId: selectedService.id,
        attendedBy,
        priceCharged: Number(price),
        paymentMethod: payNow ? paymentMethod : null,
        paymentBank: payNow && paymentMethod === 'transfer' ? paymentBank : null,
        paymentStatus: payNow ? 'paid' : 'unpaid',
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(payNow ? 'Servicio registrado y cobrado' : 'Servicio registrado · pago pendiente');
          handleClose();
        },
        onError: () => toast.error('Error al registrar servicio'),
      }
    );
  }

  const canSubmit =
    !!selectedService &&
    !!selectedClientResourceId &&
    !!attendedBy &&
    !!price &&
    (paymentTiming === 'later' || paymentMethod !== 'transfer' || !!paymentBank);

  const body = (
    <>
      <div className="space-y-5">
          {/* Service combobox — searchable + keyboard-nav so the picker
              scales beyond a handful of cards. Recent picks sticky at
              the top so a busy cashier just hits Enter. */}
          <div>
            <label className="mb-2 block text-sm font-medium">Servicio</label>
            <ServiceCombobox
              services={services}
              selected={selectedService}
              recentIds={recentServiceIds}
              isLoading={servicesLoading}
              onSelect={handleSelectService}
            />
          </div>

          {/* Client resource search */}
          <div>
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
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
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
              <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
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
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Employee select */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Empleado</label>
            <Select value={attendedBy} onValueChange={setAttendedBy}>
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

          {/* Price */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Precio</label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Timing toggle — cobrar ahora vs cobrar al retirar.
              Default "ahora" preserves the legacy flow; "al retirar"
              is the car-wash pickup case where the cashier registers
              the service first and collects when the customer recoge
              el vehículo. */}
          <div>
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

          {/* Notes */}
          <div>
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
