'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Check, Plus, Loader2, X } from 'lucide-react';
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
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { useServices } from '@/presentation/hooks/use-services';
import { useClients, useCreateClient } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useTeam } from '@/presentation/hooks/use-team';
import { useCreateServiceLog } from '@/presentation/hooks/use-service-logs';
import type { Service } from '@/domain/entities/service';
import type { PaymentMethod } from '@/domain/entities/service-log';
import type { ClientResource } from '@/domain/entities/client-resource';
import type { BusinessType, CustomField } from '@/domain/entities/tenant';

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

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Efectivo', icon: '\uD83D\uDCB5' },
  { value: 'card', label: 'Tarjeta', icon: '\uD83D\uDCB3' },
  { value: 'transfer', label: 'Transfer', icon: '\uD83D\uDD04' },
  { value: 'other', label: 'Otro', icon: '\uD83D\uDCCB' },
];

interface NewServiceModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewServiceModal({ open, onClose }: NewServiceModalProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientResourceId, setSelectedClientResourceId] = useState<string | null>(null);
  const [selectedClientResource, setSelectedClientResource] = useState<ClientResource | null>(null);
  const [attendedBy, setAttendedBy] = useState('');
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

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
    setNotes('');
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  function handleSelectService(svc: Service) {
    setSelectedService(svc);
    setPrice(String(svc.price));
  }

  function handleSubmit() {
    if (!selectedClientResourceId || !selectedService || !attendedBy || !price) return;

    createMutation.mutate(
      {
        clientResourceId: selectedClientResourceId,
        serviceId: selectedService.id,
        attendedBy,
        priceCharged: Number(price),
        paymentMethod,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Servicio registrado');
          handleClose();
        },
        onError: () => toast.error('Error al registrar servicio'),
      }
    );
  }

  const canSubmit = !!selectedService && !!selectedClientResourceId && !!attendedBy && !!price;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo Servicio</DialogTitle>
          <DialogDescription>Registrar un servicio realizado</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Service selection as cards */}
          <div>
            <label className="mb-2 block text-sm font-medium">Servicio</label>
            <div className="grid grid-cols-2 gap-2">
              {servicesLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))
                : services
                    .filter((s) => s.isActive)
                    .map((svc) => (
                      <Card
                        key={svc.id}
                        className={cn(
                          'cursor-pointer transition-all',
                          selectedService?.id === svc.id
                            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                            : 'hover:border-zinc-300'
                        )}
                        onClick={() => handleSelectService(svc)}
                      >
                        <CardContent className="flex items-center gap-2 p-3">
                          {selectedService?.id === svc.id && (
                            <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{svc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Intl.NumberFormat('es-CO', {
                                style: 'currency',
                                currency: 'COP',
                                minimumFractionDigits: 0,
                              }).format(svc.price)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
            </div>
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
                placeholder={
                  hasCustomFields
                    ? `Buscar por ${customFields[0].label.toLowerCase()}...`
                    : 'Buscar cliente o registro...'
                }
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

          {/* Payment method radio-style buttons */}
          <div>
            <label className="mb-2 block text-sm font-medium">Metodo de pago</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-all',
                    paymentMethod === opt.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)] ring-1 ring-[var(--color-primary)]/20'
                      : 'hover:bg-zinc-50'
                  )}
                  onClick={() => setPaymentMethod(opt.value)}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
            Registrar Servicio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
