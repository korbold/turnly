'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  KeyRound,
  Upload,
  CheckCircle2,
  Store,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Badge } from '@/presentation/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/presentation/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { Switch } from '@/presentation/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  useBillingProfile,
  useUpdateBillingProfile,
  useLookupTaxId,
  useSettings,
  useUpdateSettings,
} from '@/presentation/hooks/use-settings';
import api from '@/infrastructure/api/client';
import type { BillingProfileInput, TaxIdType } from '@/domain/entities/tenant';

function useDebounced<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface CertData {
  cert_configured: boolean;
  ruc?: string;
  ambiente?: number;
  /** Establecimiento + punto de emisión the next invoice is issued from. */
  estab?: string | null;
  pto_emi?: string | null;
  nombre_establecimiento?: string | null;
  dir_establecimiento?: string | null;
  secuencial_actual?: number | null;
}

interface EmissionForm {
  estab: string;
  ptoEmi: string;
  nombre: string;
  dirEstablecimiento: string;
}

/** The SRI wants both codes as three digits — "2" is stored as "002". */
function padCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 3);
  return digits ? digits.padStart(3, '0') : '';
}

function StepIndicator({ step, done, label }: { step: number; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done
            ? 'bg-[#0B7A44] text-white'
            : 'bg-[var(--bg-subtle,#F3F4F6)] text-[var(--fg-muted)] border border-[var(--border-default)]'
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
      </span>
      <span className="text-[12px] font-medium text-[var(--fg-muted)]">{label}</span>
    </div>
  );
}

export function BillingTab() {
  const { data: profile, isLoading } = useBillingProfile();
  const update = useUpdateBillingProfile();
  const queryClient = useQueryClient();
  const { data: tenantSettings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [form, setForm] = useState<Partial<BillingProfileInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedAmbiente, setSelectedAmbiente] = useState<number>(1);
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [emission, setEmission] = useState<EmissionForm>({
    estab: '001',
    ptoEmi: '001',
    nombre: 'Matriz',
    dirEstablecimiento: '',
  });
  const [emissionErrors, setEmissionErrors] = useState<Record<string, string>>({});
  const [isProduccion, setIsProduccion] = useState(false);
  const [confirmProduccion, setConfirmProduccion] = useState(false);

  const { data: certData, isLoading: certLoading } = useQuery<CertData | null>({
    queryKey: ['billing-cert'],
    queryFn: async () => {
      const { data } = await api.get('/settings/billing-cert');
      return data?.data ?? null;
    },
  });

  const uploadCertMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const { data } = await api.post('/settings/billing-cert', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Certificado actualizado');
      setCertFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (passwordRef.current) passwordRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['billing-cert'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? 'Error al subir el certificado');
    },
  });

  const updateEmissionMutation = useMutation({
    mutationFn: async (payload: {
      ambiente: number;
      estab: string;
      pto_emi: string;
      nombre: string;
      dir_establecimiento: string;
    }) => {
      const { data } = await api.put('/settings/billing-emission', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Establecimiento y ambiente guardados');
      queryClient.invalidateQueries({ queryKey: ['billing-cert'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? 'Error al guardar el establecimiento');
    },
  });

  function handleCertSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!certFile) return;
    const fd = new FormData();
    fd.append('p12_file', certFile);
    fd.append('p12_password', passwordRef.current?.value ?? '');
    fd.append('ambiente', selectedAmbiente.toString());
    uploadCertMutation.mutate(fd);
  }

  useEffect(() => {
    if (profile) {
      setForm({
        taxId: profile.taxId ?? '',
        legalName: profile.legalName ?? '',
        billingEmail: profile.billingEmail ?? '',
        billingAddress: profile.billingAddress ?? '',
        billingPhone: profile.billingPhone ?? '',
      });
    }
  }, [profile]);

  // Seed the emission form once from the billing service. Guarded by a ref so a
  // background refetch can't wipe out what the user is halfway through typing.
  const emissionSeeded = useRef(false);
  useEffect(() => {
    if (!certData || emissionSeeded.current) return;
    emissionSeeded.current = true;
    setEmission({
      estab: certData.estab ?? '001',
      ptoEmi: certData.pto_emi ?? '001',
      nombre: certData.nombre_establecimiento ?? 'Matriz',
      dirEstablecimiento: certData.dir_establecimiento ?? profile?.billingAddress ?? '',
    });
    setIsProduccion(certData.ambiente === 2);
    setSelectedAmbiente(certData.ambiente ?? 1);
  }, [certData, profile?.billingAddress]);

  const debouncedTaxId = useDebounced(form.taxId ?? '');
  const lookupEnabled = debouncedTaxId.length >= 10;

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

  function handle<K extends keyof BillingProfileInput>(key: K, value: BillingProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

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
        taxIdType: 'ruc',
        taxId: form.taxId!.trim(),
        legalName: form.legalName!.trim(),
        billingEmail: form.billingEmail!.trim(),
        billingAddress: form.billingAddress!.trim(),
        billingPhone: form.billingPhone?.trim() || null,
      });
      toast.success('Datos del emisor guardados');
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Error al guardar';
      toast.error(msg);
    }
  }

  function handleEmissionField<K extends keyof EmissionForm>(key: K, value: string) {
    setEmission((prev) => ({ ...prev, [key]: value }));
    setEmissionErrors((e) => ({ ...e, [key]: '' }));
  }

  function saveEmission(ambiente: number) {
    const estab = padCode(emission.estab);
    const ptoEmi = padCode(emission.ptoEmi);
    const e: Record<string, string> = {};

    if (estab.length !== 3) e.estab = 'Tres dígitos, ej. 001';
    if (ptoEmi.length !== 3) e.ptoEmi = 'Tres dígitos, ej. 001';
    if (!emission.nombre.trim()) e.nombre = 'Requerido';
    if (!emission.dirEstablecimiento.trim()) e.dirEstablecimiento = 'Requerido';

    setEmissionErrors(e);
    if (Object.keys(e).length > 0) return;

    setEmission((prev) => ({ ...prev, estab, ptoEmi }));
    updateEmissionMutation.mutate({
      ambiente,
      estab,
      pto_emi: ptoEmi,
      nombre: emission.nombre.trim(),
      dir_establecimiento: emission.dirEstablecimiento.trim(),
    });
  }

  const estabChanged =
    !!certData?.estab &&
    (padCode(emission.estab) !== certData.estab || padCode(emission.ptoEmi) !== certData.pto_emi);

  const profileComplete = !!(
    profile?.taxId &&
    profile?.legalName &&
    profile?.billingEmail &&
    profile?.billingAddress
  );
  const certConfigured = certData?.cert_configured ?? false;

  const lookupBadge = useMemo(() => {
    if (!lookupEnabled) return null;
    if (isLookingUp) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Verificando con SRI...
        </span>
      );
    }
    if (!lookup) return null;
    if (!lookup.formatValid) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-[#A91D2C]">
          <ShieldX className="h-3.5 w-3.5" aria-hidden="true" /> Formato inválido
        </span>
      );
    }
    if (lookup.lookup) {
      const active = lookup.lookup.estado.toUpperCase() === 'ACTIVO';
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            active ? 'text-[#0B7A44]' : 'text-[#B47114]'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {active
            ? `Verificado: ${lookup.lookup.razonSocial}`
            : `Estado SRI: ${lookup.lookup.estado}`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#B47114]">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Formato OK, no verificado en SRI
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
    <div className="max-w-2xl space-y-3">
      {/* IVA pricing mode */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex-1">
            <p className="text-[14px] font-medium leading-snug">Modo IVA de tus precios</p>
            <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
              Define cómo el sistema trata el IVA al generar facturas electrónicas para el SRI.
            </p>
          </div>
          <Select
            value={tenantSettings?.ivaMode ?? 'excluded'}
            disabled={updateSettings.isPending}
            onValueChange={(value) => {
              updateSettings.mutate(
                { ivaMode: value as 'excluded' | 'included' | 'zero' },
                { onSuccess: () => toast.success('Modo IVA guardado') },
              );
            }}
          >
            <SelectTrigger className="w-52 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excluded">Precio sin IVA (se agrega 15%)</SelectItem>
              <SelectItem value="included">Precio incluye IVA 15%</SelectItem>
              <SelectItem value="zero">IVA 0%</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Progress steps */}
      <div className="flex items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle,#F9FAFB)] px-4 py-3">
        <StepIndicator step={1} done={profileComplete} label="Datos del emisor" />
        <div className="h-px flex-1 bg-[var(--border-default)]" />
        <StepIndicator step={2} done={certConfigured} label="Certificado .p12" />
        <div className="h-px flex-1 bg-[var(--border-default)]" />
        <StepIndicator step={3} done={certConfigured && isProduccion} label="Producción" />
      </div>

      {/* Step 1 — Billing profile */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-[15px]">Datos del emisor</CardTitle>
          <CardDescription>
            Identificación fiscal que aparecerá en las facturas electrónicas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>RUC del emisor</Label>
            <Input
              value={form.taxId ?? ''}
              onChange={(e) => handle('taxId', e.target.value.replace(/\s/g, ''))}
              placeholder="13 dígitos (...001)"
              maxLength={13}
            />
            {errors.taxId && <p className="text-xs text-[var(--danger-500)]">{errors.taxId}</p>}
            {lookupBadge}
          </div>

          <div className="space-y-1.5">
            <Label>Razón social / Nombres</Label>
            <Input
              value={form.legalName ?? ''}
              onChange={(e) => handle('legalName', e.target.value)}
              placeholder="Como aparece en SRI"
            />
            {errors.legalName && (
              <p className="text-xs text-[var(--danger-500)]">{errors.legalName}</p>
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
                <p className="text-xs text-[var(--danger-500)]">{errors.billingEmail}</p>
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
              <p className="text-xs text-[var(--danger-500)]">{errors.billingAddress}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t pt-4">
          {profile?.billingVerified ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#0B7A44]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verificado en SRI
            </span>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Guardar datos
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Step 2 — Certificate */}
      <Card className={!profileComplete ? 'opacity-60 pointer-events-none' : ''}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                Certificado digital SRI
              </CardTitle>
              <CardDescription className="mt-1">
                Archivo .p12 emitido por el Banco Central o Security Data para firmar facturas.
              </CardDescription>
            </div>
            {!certLoading &&
              (certConfigured ? (
                <Badge className="shrink-0 bg-green-100 text-green-800 border-green-200">
                  <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                  Activo · {certData?.ambiente === 1 ? 'Pruebas' : 'Producción'}
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 text-muted-foreground">
                  Sin certificado
                </Badge>
              ))}
          </div>
        </CardHeader>

        <form onSubmit={handleCertSubmit}>
          <CardContent className="space-y-3">
            {!profileComplete && (
              <p className="rounded-md bg-[var(--bg-subtle,#F9FAFB)] border border-[var(--border-default)] px-3 py-2 text-[12px] text-[var(--fg-muted)]">
                Completa el paso 1 primero — se necesita el RUC y razón social para registrar el certificado.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p12_file">{certConfigured ? 'Reemplazar archivo .p12' : 'Archivo .p12'}</Label>
              <Input
                id="p12_file"
                ref={fileInputRef}
                type="file"
                accept=".p12,.pfx"
                className="cursor-pointer"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              {certFile && (
                <p className="text-xs text-[var(--fg-muted)]">
                  {certFile.name} · {(certFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p12_password">Contraseña del certificado</Label>
              <Input
                id="p12_password"
                ref={passwordRef}
                type="password"
                autoComplete="off"
                placeholder="••••••••"
              />
            </div>

            {/* First upload only — once the cert exists the ambiente is owned by
                the "Establecimiento y ambiente" card below, which changes it
                without re-sending the .p12. */}
            {!certConfigured && (
              <div className="space-y-1.5">
                <Label>Ambiente SRI</Label>
                <Select
                  value={String(selectedAmbiente)}
                  onValueChange={(v) => setSelectedAmbiente(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Pruebas</SelectItem>
                    <SelectItem value="2">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t pt-4">
            <Button
              type="submit"
              disabled={!certFile || uploadCertMutation.isPending}
              variant="secondary"
              className="ml-auto"
            >
              {uploadCertMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  {certConfigured ? 'Actualizar certificado' : 'Subir certificado'}
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Step 3 — Establecimiento + ambiente. Only reachable once the cert
          exists: the billing service owns this row and 404s without it. */}
      {certConfigured && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Establecimiento y ambiente
                </CardTitle>
                <CardDescription className="mt-1">
                  Punto de venta desde el que se emiten las facturas y si van al SRI de
                  pruebas o de producción.
                </CardDescription>
              </div>
              <Badge
                className={
                  isProduccion
                    ? 'shrink-0 bg-green-100 text-green-800 border-green-200'
                    : 'shrink-0 bg-amber-100 text-amber-800 border-amber-200'
                }
              >
                {isProduccion ? 'Producción' : 'Pruebas'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="estab">Código de establecimiento</Label>
                <Input
                  id="estab"
                  value={emission.estab}
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="001"
                  onChange={(e) => handleEmissionField('estab', e.target.value.replace(/\D/g, ''))}
                  onBlur={() => handleEmissionField('estab', padCode(emission.estab))}
                />
                {emissionErrors.estab && (
                  <p className="text-xs text-[var(--danger-500)]">{emissionErrors.estab}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pto_emi">Punto de emisión</Label>
                <Input
                  id="pto_emi"
                  value={emission.ptoEmi}
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="001"
                  onChange={(e) => handleEmissionField('ptoEmi', e.target.value.replace(/\D/g, ''))}
                  onBlur={() => handleEmissionField('ptoEmi', padCode(emission.ptoEmi))}
                />
                {emissionErrors.ptoEmi && (
                  <p className="text-xs text-[var(--danger-500)]">{emissionErrors.ptoEmi}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estab_nombre">Nombre del establecimiento</Label>
              <Input
                id="estab_nombre"
                value={emission.nombre}
                placeholder="Matriz"
                onChange={(e) => handleEmissionField('nombre', e.target.value)}
              />
              {emissionErrors.nombre && (
                <p className="text-xs text-[var(--danger-500)]">{emissionErrors.nombre}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="estab_dir">Dirección del establecimiento</Label>
                {!!profile?.billingAddress && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-[var(--fg-muted)] underline underline-offset-2 hover:text-[var(--fg-default)]"
                    onClick={() =>
                      handleEmissionField('dirEstablecimiento', profile.billingAddress ?? '')
                    }
                  >
                    Usar la dirección de la matriz
                  </button>
                )}
              </div>
              <Input
                id="estab_dir"
                value={emission.dirEstablecimiento}
                placeholder="Calle, número, ciudad"
                onChange={(e) => handleEmissionField('dirEstablecimiento', e.target.value)}
              />
              {emissionErrors.dirEstablecimiento && (
                <p className="text-xs text-[var(--danger-500)]">
                  {emissionErrors.dirEstablecimiento}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-default)] px-3 py-3">
              <div className="flex-1">
                <Label htmlFor="ambiente_switch" className="text-[14px]">
                  Emitir en producción
                </Label>
                <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">
                  {isProduccion
                    ? 'Las facturas se envían al SRI real y tienen validez legal.'
                    : 'Las facturas se envían al SRI de pruebas y no tienen validez legal.'}
                </p>
              </div>
              <Switch
                id="ambiente_switch"
                checked={isProduccion}
                disabled={updateEmissionMutation.isPending}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setConfirmProduccion(true);
                    return;
                  }
                  setIsProduccion(false);
                }}
              />
            </div>

            {estabChanged && (
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                El secuencial arranca en 000000001 para este establecimiento y punto de
                emisión — el SRI los cuenta por separado. El anterior queda intacto.
              </p>
            )}

            {typeof certData?.secuencial_actual === 'number' && (
              <p className="text-[12px] text-[var(--fg-muted)]">
                Última factura emitida en {certData.estab}-{certData.pto_emi}:{' '}
                {String(certData.secuencial_actual).padStart(9, '0')}
              </p>
            )}
          </CardContent>

          <CardFooter className="border-t pt-4">
            <Button
              onClick={() => saveEmission(isProduccion ? 2 : 1)}
              disabled={updateEmissionMutation.isPending}
              className="ml-auto"
            >
              {updateEmissionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                  Guardar
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={confirmProduccion} onOpenChange={setConfirmProduccion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pasar a producción?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Desde ahora las facturas se envían al SRI real y tienen validez legal: una
                  vez autorizadas no se pueden borrar, sólo anular ante el SRI.
                </p>
                <p>
                  Revisa que el RUC {profile?.taxId} y el establecimiento{' '}
                  {padCode(emission.estab) || '001'} estén abiertos en el SRI, o los
                  comprobantes serán rechazados.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmProduccion(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmProduccion(false);
                setIsProduccion(true);
                saveEmission(2);
              }}
            >
              Sí, emitir en producción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
