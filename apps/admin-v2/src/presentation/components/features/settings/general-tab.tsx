'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Save, Upload, X, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/infrastructure/api/client';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';
import type { TenantSettings, BusinessType } from '@/domain/entities/tenant';

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'car_wash', label: 'Car Wash' },
  { value: 'barbershop', label: 'Barberia' },
  { value: 'medical', label: 'Clinica' },
  { value: 'spa', label: 'Spa' },
  { value: 'gym', label: 'Gym' },
  { value: 'other', label: 'Otro' },
];

function buildFormFromSettings(settings: TenantSettings | undefined): Partial<TenantSettings> {
  if (!settings) return {};
  return {
    name: settings.name,
    businessType: settings.businessType,
    description: settings.description,
    address: settings.address,
    phone: settings.phone,
    slotDuration: settings.slotDuration,
    cancellationHours: settings.cancellationHours,
    defaultTaxRate: settings.defaultTaxRate,
    autoConfirmReservations: settings.autoConfirmReservations,
    socialLinks: settings.socialLinks ?? { instagram: null, facebook: null, whatsapp: null, maps_url: null },
    logoUrl: settings.logoUrl,
    coverUrl: settings.coverUrl,
  };
}

export function GeneralTab() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();

  const [form, setForm] = useState<Partial<TenantSettings>>({});
  const [baseline, setBaseline] = useState<Partial<TenantSettings>>({});
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      const next = buildFormFromSettings(settings);
      setForm(next);
      setBaseline(next);
    }
  }, [settings]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  function handleDiscard() {
    setForm(baseline);
  }

  async function uploadImage(file: File, folder: 'logos' | 'covers'): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    const { data } = await api.post<{ data: { url: string } }>('/uploads', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.url;
  }

  async function handleFile(kind: 'logo' | 'cover', file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen muy grande (máx 5MB)');
      return;
    }
    setUploading(kind);
    try {
      const folder = kind === 'logo' ? 'logos' : 'covers';
      const url = await uploadImage(file, folder);
      const key = kind === 'logo' ? 'logoUrl' : 'coverUrl';
      setForm((prev) => ({ ...prev, [key]: url }));
      setBaseline((prev) => ({ ...prev, [key]: url }));
      await update.mutateAsync({ [key]: url });
      toast.success(kind === 'logo' ? 'Logo actualizado' : 'Portada actualizada');
    } catch {
      toast.error('Error al subir imagen');
    } finally {
      setUploading(null);
    }
  }

  async function clearImage(kind: 'logo' | 'cover') {
    const key = kind === 'logo' ? 'logoUrl' : 'coverUrl';
    setForm((prev) => ({ ...prev, [key]: null }));
    setBaseline((prev) => ({ ...prev, [key]: null }));
    try {
      await update.mutateAsync({ [key]: null });
    } catch {
      toast.error('Error al eliminar imagen');
    }
  }

  function handleChange(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSocialChange(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: value || null } as TenantSettings['socialLinks'],
    }));
  }

  async function handleSave() {
    try {
      const payload = {
        ...form,
        slotDuration: form.slotDuration || 30,
        cancellationHours: form.cancellationHours ?? 0,
        defaultTaxRate: form.defaultTaxRate ?? 15,
        autoConfirmReservations: form.autoConfirmReservations ?? false,
      };
      await update.mutateAsync(payload);
      setBaseline(form);
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5 pb-24">
      {/* Identidad: imágenes + nombre + tipo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold">Identidad</CardTitle>
          <p className="text-xs text-[var(--fg-muted)]">Cómo se ve tu negocio en la página pública.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <Label>Logo</Label>
                <span className="text-[11px] text-[var(--fg-muted)]">PNG · JPG · 5 MB</span>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFile('logo', e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                aria-label="Subir logo"
                className="group relative mt-1.5 flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)] transition-[border-color,background-color] duration-150 ease-out hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(42,109,244,0.20)] focus-visible:ring-offset-1"
              >
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <Upload className="h-5 w-5 text-[var(--fg-muted)] transition-colors duration-150 group-hover:text-[var(--brand-500)]" aria-hidden="true" />
                )}
                {uploading === 'logo' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-500)]" aria-hidden="true" />
                  </span>
                )}
              </button>
              {form.logoUrl && uploading !== 'logo' && (
                <button
                  type="button"
                  onClick={() => clearImage('logo')}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-[var(--fg-muted)] transition-colors duration-150 hover:text-[var(--danger-500)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  Quitar
                </button>
              )}
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <Label>Portada</Label>
                <span className="text-[11px] text-[var(--fg-muted)]">PNG · JPG · 5 MB</span>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFile('cover', e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                aria-label="Subir portada"
                className="group relative mt-1.5 flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)] transition-[border-color,background-color] duration-150 ease-out hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(42,109,244,0.20)] focus-visible:ring-offset-1"
              >
                {form.coverUrl ? (
                  <img src={form.coverUrl} alt="Portada" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-[var(--fg-muted)] transition-colors duration-150 group-hover:text-[var(--brand-500)]" aria-hidden="true" />
                )}
                {uploading === 'cover' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-500)]" aria-hidden="true" />
                  </span>
                )}
              </button>
              {form.coverUrl && uploading !== 'cover' && (
                <button
                  type="button"
                  onClick={() => clearImage('cover')}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-[var(--fg-muted)] transition-colors duration-150 hover:text-[var(--danger-500)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  Quitar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre del negocio</Label>
              <Input value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de negocio</Label>
              <Select value={form.businessType ?? ''} onValueChange={(v) => handleChange('businessType', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((bt) => (
                    <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Una línea sobre tu negocio para los clientes."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Slug (URL)</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--fg-muted)]">turnly.com/</span>
              <Input
                value={settings?.slug ?? ''}
                readOnly
                className="bg-[var(--niebla-clara,#F4F5F7)] text-[var(--fg-muted)]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacto + reglas de reserva */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold">Contacto y reservas</CardTitle>
          <p className="text-xs text-[var(--fg-muted)]">Datos visibles para tus clientes y reglas básicas de reserva.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.address ?? ''} onChange={(e) => handleChange('address', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone ?? ''} onChange={(e) => handleChange('phone', e.target.value)} placeholder="0987654321" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Duración de slot</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={5}
                  value={form.slotDuration ?? ''}
                  onChange={(e) => handleChange('slotDuration', e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-muted)]">min</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Anticipación para cancelar</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={form.cancellationHours ?? ''}
                  onChange={(e) => handleChange('cancellationHours', e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-muted)]">horas</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>IVA por defecto</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.defaultTaxRate ?? ''}
                  onChange={(e) => handleChange('defaultTaxRate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-muted)]">%</span>
              </div>
              <p className="text-[11px] text-[var(--fg-muted)]">
                Se aplica a productos nuevos. Tarifa SRI Ecuador actual: 15%.
              </p>
            </div>
          </div>

          {/* Auto-confirm toggle. Off by default so the staff reviews
              each booking before it counts as Confirmada. */}
          <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-app)]/40 p-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--fg-strong)]">
                Aceptar citas automáticamente
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--fg-muted)]">
                Cuando está activo, las reservas nuevas saltan el paso de
                aprobación manual y entran como <strong>Confirmada</strong>.
                Útil para negocios que aceptan todo lo que entra.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={Boolean(form.autoConfirmReservations)}
                onChange={(e) =>
                  handleChange('autoConfirmReservations', e.target.checked as unknown as never)
                }
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-[var(--ink-100)] transition-colors peer-checked:bg-[var(--brand-600)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Redes sociales + ubicación */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold">Redes y ubicación</CardTitle>
          <p className="text-xs text-[var(--fg-muted)]">Enlaces que aparecen en tu perfil público.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Instagram</Label>
              <Input
                placeholder="@usuario"
                value={form.socialLinks?.instagram ?? ''}
                onChange={(e) => handleSocialChange('instagram', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Facebook</Label>
              <Input
                placeholder="URL o usuario"
                value={form.socialLinks?.facebook ?? ''}
                onChange={(e) => handleSocialChange('facebook', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp</Label>
              <Input
                placeholder="+593..."
                value={form.socialLinks?.whatsapp ?? ''}
                onChange={(e) => handleSocialChange('whatsapp', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL de ubicación (Google Maps / Waze)</Label>
            <Input
              placeholder="https://maps.google.com/..."
              value={form.socialLinks?.maps_url ?? ''}
              onChange={(e) => handleSocialChange('maps_url', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Floating save bar: always visible, actions enabled when dirty */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4"
      >
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-full border border-[var(--border-soft)] bg-white py-2 pl-4 pr-2 shadow-[0_14px_32px_-8px_rgba(15,18,26,0.12),0_4px_8px_-4px_rgba(15,18,26,0.06)]">
          {isDirty ? (
            <>
              <span className="hidden h-2 w-2 shrink-0 rounded-full bg-[var(--brand-500)] sm:inline-block" aria-hidden="true" />
              <p className="flex-1 truncate text-[13px] text-[var(--fg-default,#2E3441)]">
                <span className="font-medium">Cambios sin guardar.</span>{' '}
                <span className="text-[var(--fg-muted)]">Guárdalos antes de salir.</span>
              </p>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={update.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[var(--fg-default,#4B5462)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--niebla-media,#EEF0F3)] active:scale-[0.97] disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Descartar
              </button>
            </>
          ) : (
            <p className="flex-1 truncate text-[13px] text-[var(--fg-muted)]">Configuración guardada</p>
          )}
          <Button onClick={handleSave} disabled={update.isPending || !isDirty} className="h-9 rounded-full">
            {update.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Guardar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
