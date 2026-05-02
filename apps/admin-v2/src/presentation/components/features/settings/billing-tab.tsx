'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import {
  useBillingProfile,
  useUpdateBillingProfile,
  useLookupTaxId,
} from '@/presentation/hooks/use-settings';
import type {
  BillingProfileInput,
  TaxIdType,
} from '@/domain/entities/tenant';

const ID_TYPES: { value: TaxIdType; label: string }[] = [
  { value: 'ruc', label: 'RUC' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'pasaporte', label: 'Pasaporte' },
];

function useDebounced<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function BillingTab() {
  const { data: profile, isLoading } = useBillingProfile();
  const update = useUpdateBillingProfile();

  const [form, setForm] = useState<Partial<BillingProfileInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setForm({
        taxIdType: profile.taxIdType ?? undefined,
        taxId: profile.taxId ?? '',
        legalName: profile.legalName ?? '',
        billingEmail: profile.billingEmail ?? '',
        billingAddress: profile.billingAddress ?? '',
        billingPhone: profile.billingPhone ?? '',
      });
    }
  }, [profile]);

  const debouncedTaxId = useDebounced(form.taxId ?? '');
  const lookupEnabled =
    !!form.taxIdType &&
    form.taxIdType !== 'pasaporte' &&
    debouncedTaxId.length >= 10;

  const { data: lookup, isFetching: isLookingUp } = useLookupTaxId(
    form.taxIdType ?? null,
    debouncedTaxId,
    lookupEnabled,
  );

  useEffect(() => {
    if (lookup?.lookup?.razonSocial && !form.legalName) {
      setForm((prev) => ({ ...prev, legalName: lookup.lookup!.razonSocial }));
    }
  }, [lookup]); // eslint-disable-line react-hooks/exhaustive-deps

  function handle<K extends keyof BillingProfileInput>(
    key: K,
    value: BillingProfileInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.taxIdType) e.taxIdType = 'Selecciona un tipo';
    if (!form.taxId) e.taxId = 'Requerido';
    if (!form.legalName) e.legalName = 'Requerido';
    if (!form.billingEmail) {
      e.billingEmail = 'Requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billingEmail)) {
      e.billingEmail = 'Email inválido';
    }
    if (!form.billingAddress) e.billingAddress = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      await update.mutateAsync({
        taxIdType: form.taxIdType!,
        taxId: form.taxId!.trim(),
        legalName: form.legalName!.trim(),
        billingEmail: form.billingEmail!.trim(),
        billingAddress: form.billingAddress!.trim(),
        billingPhone: form.billingPhone?.trim() || null,
      });
      toast.success('Datos de facturación guardados');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(msg);
    }
  }

  const lookupBadge = useMemo(() => {
    if (!lookupEnabled) return null;
    if (isLookingUp) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando con SRI...
        </span>
      );
    }
    if (!lookup) return null;
    if (!lookup.formatValid) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <ShieldX className="h-3.5 w-3.5" /> Formato inválido
        </span>
      );
    }
    if (lookup.lookup) {
      const active = lookup.lookup.estado.toUpperCase() === 'ACTIVO';
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            active ? 'text-emerald-600' : 'text-amber-600'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {active
            ? `Verificado: ${lookup.lookup.razonSocial}`
            : `Estado SRI: ${lookup.lookup.estado}`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <ShieldAlert className="h-3.5 w-3.5" /> Formato OK, no verificado en SRI
      </span>
    );
  }, [lookup, isLookingUp, lookupEnabled]);

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Datos de facturación</h2>
        <p className="text-sm text-zinc-500">
          Necesitamos estos datos para emitir la factura electrónica cuando contrates un plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Tipo identificación</Label>
          <Select
            value={form.taxIdType ?? ''}
            onValueChange={(v) => handle('taxIdType', v as TaxIdType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {ID_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.taxIdType && (
            <p className="text-xs text-red-500">{errors.taxIdType}</p>
          )}
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label>Número</Label>
          <Input
            value={form.taxId ?? ''}
            onChange={(e) => handle('taxId', e.target.value.replace(/\s/g, ''))}
            placeholder={
              form.taxIdType === 'ruc'
                ? '13 dígitos (...001)'
                : form.taxIdType === 'cedula'
                  ? '10 dígitos'
                  : 'Pasaporte'
            }
          />
          {errors.taxId && <p className="text-xs text-red-500">{errors.taxId}</p>}
          {lookupBadge}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Razón social / Nombres</Label>
        <Input
          value={form.legalName ?? ''}
          onChange={(e) => handle('legalName', e.target.value)}
          placeholder="Como aparece en SRI"
        />
        {errors.legalName && (
          <p className="text-xs text-red-500">{errors.legalName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Email facturación</Label>
          <Input
            type="email"
            value={form.billingEmail ?? ''}
            onChange={(e) => handle('billingEmail', e.target.value)}
            placeholder="facturas@negocio.com"
          />
          {errors.billingEmail && (
            <p className="text-xs text-red-500">{errors.billingEmail}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Teléfono (opcional)</Label>
          <Input
            value={form.billingPhone ?? ''}
            onChange={(e) => handle('billingPhone', e.target.value)}
            placeholder="0987654321"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Dirección</Label>
        <Input
          value={form.billingAddress ?? ''}
          onChange={(e) => handle('billingAddress', e.target.value)}
          placeholder="Calle, número, ciudad"
        />
        {errors.billingAddress && (
          <p className="text-xs text-red-500">{errors.billingAddress}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        {profile?.billingVerified ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <ShieldCheck className="h-3.5 w-3.5" /> Verificado en SRI
          </span>
        ) : (
          <span />
        )}
        <Button
          onClick={handleSave}
          disabled={update.isPending}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
        >
          {update.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Guardar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
