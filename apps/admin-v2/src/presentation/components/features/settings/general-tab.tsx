'use client';

import { useState, useEffect } from 'react';
import { Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Skeleton } from '@/presentation/components/ui/skeleton';
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

export function GeneralTab() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();

  const [form, setForm] = useState<Partial<TenantSettings>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name,
        businessType: settings.businessType,
        description: settings.description,
        address: settings.address,
        phone: settings.phone,
        slotDuration: settings.slotDuration,
        cancellationHours: settings.cancellationHours,
        socialLinks: settings.socialLinks ?? { instagram: null, facebook: null, whatsapp: null, maps_url: null },
      });
    }
  }, [settings]);

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
      };
      await update.mutateAsync(payload);
      toast.success('Configuracion guardada');
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
    <div className="max-w-2xl space-y-6">
      {/* Logo + Cover placeholders */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Logo</Label>
          <div className="mt-1 flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <Upload className="h-5 w-5 text-zinc-400" />
            )}
          </div>
        </div>
        <div>
          <Label>Portada</Label>
          <div className="mt-1 flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50">
            {settings?.coverUrl ? (
              <img src={settings.coverUrl} alt="Cover" className="h-full w-full rounded-lg object-cover" />
            ) : (
              <Upload className="h-5 w-5 text-zinc-400" />
            )}
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label>Nombre del negocio</Label>
        <Input value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} />
      </div>

      {/* Business type */}
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

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Descripcion</Label>
        <Textarea
          rows={3}
          value={form.description ?? ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>

      {/* Address + Phone */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Direccion</Label>
          <Input value={form.address ?? ''} onChange={(e) => handleChange('address', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefono</Label>
          <Input value={form.phone ?? ''} onChange={(e) => handleChange('phone', e.target.value)} />
        </div>
      </div>

      {/* Slug (readonly) */}
      <div className="space-y-1.5">
        <Label>Slug (URL)</Label>
        <Input value={settings?.slug ?? ''} readOnly className="bg-zinc-50 text-muted-foreground" />
      </div>

      {/* Slot duration + Cancellation hours */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Duracion de slots (minutos)</Label>
          <Input
            type="number"
            min={5}
            value={form.slotDuration ?? ''}
            onChange={(e) => handleChange('slotDuration', e.target.value === '' ? '' : parseInt(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Horas para cancelar</Label>
          <Input
            type="number"
            min={0}
            value={form.cancellationHours ?? ''}
            onChange={(e) => handleChange('cancellationHours', e.target.value === '' ? '' : parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* Social links */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Redes Sociales</Label>
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
              placeholder="+57..."
              value={form.socialLinks?.whatsapp ?? ''}
              onChange={(e) => handleSocialChange('whatsapp', e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL de ubicacion (Google Maps / Waze)</Label>
          <Input
            placeholder="https://maps.google.com/..."
            value={form.socialLinks?.maps_url ?? ''}
            onChange={(e) => handleSocialChange('maps_url', e.target.value)}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={update.isPending}>
        <Save className="mr-1.5 h-4 w-4" />
        {update.isPending ? 'Guardando...' : 'Guardar Cambios'}
      </Button>
    </div>
  );
}
