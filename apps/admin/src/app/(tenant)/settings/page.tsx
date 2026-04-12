'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTenantSettings, updateTenantSettings } from '@/lib/api/tenant';
import { getTenantImages, addTenantImage, deleteTenantImage } from '@/lib/api/tenant-images';
import type { TenantImage } from '@/lib/api/tenant-images';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BUSINESS_TYPES, BRAND_THEMES } from '@/lib/constants/business-types';
import {
  SECTIONS as permSections,
  EDITABLE_ROLES as permEditable,
  DEFAULT_PERMISSIONS,
  cyclePermission,
  type PermissionsConfig,
  type RolePermissions,
} from '@/lib/constants/permissions';
import { ImageUpload } from '@/components/ui/image-upload';
import { Trash2, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { getAvailabilityBlocks, createAvailabilityBlock, deleteAvailabilityBlock } from '@/lib/api/availability-blocks';
import type { AvailabilityBlock } from '@/types/availability-block';

interface CustomField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [brandTheme, setBrandTheme] = useState('blue');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    instagram: '',
    facebook: '',
    whatsapp: '',
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [permissions, setPermissions] = useState<PermissionsConfig>({ ...DEFAULT_PERMISSIONS });
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);

  const DAYS = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ] as const;

  type DaySchedule = { open: string | null; close: string | null; active: boolean };
  type WeekSchedule = Record<string, DaySchedule>;

  const DEFAULT_SCHEDULE: WeekSchedule = {
    monday:    { open: '08:00', close: '18:00', active: true },
    tuesday:   { open: '08:00', close: '18:00', active: true },
    wednesday: { open: '08:00', close: '18:00', active: true },
    thursday:  { open: '08:00', close: '18:00', active: true },
    friday:    { open: '08:00', close: '18:00', active: true },
    saturday:  { open: '09:00', close: '14:00', active: true },
    sunday:    { open: null, close: null, active: false },
  };

  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);
  const [blockDate, setBlockDate] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);

  const { data: tenantSettings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: getTenantSettings,
  });

  // Initialize form from fetched data
  useEffect(() => {
    if (!tenantSettings) return;
    const t = tenantSettings as Record<string, unknown>;
    setName((t.name as string) ?? '');
    setLogoUrl((t.logo_url as string) ?? '');
    setCoverUrl((t.cover_url as string) ?? '');
    setBusinessType((t.business_type as string) ?? '');
    setDescription((t.description as string) ?? '');
    setAddress((t.address as string) ?? '');
    setPhone((t.phone as string) ?? '');
    setBrandTheme((t.brand_theme as string) ?? 'blue');
    setSocialLinks({
      instagram: ((t.social_links as Record<string, string>)?.instagram) ?? '',
      facebook: ((t.social_links as Record<string, string>)?.facebook) ?? '',
      whatsapp: ((t.social_links as Record<string, string>)?.whatsapp) ?? '',
    });
    if (Array.isArray(t.custom_fields)) {
      setCustomFields(t.custom_fields as CustomField[]);
    }
    // Load custom permissions from settings.permissions
    const settings = t.settings as Record<string, unknown> | null;
    if (settings?.permissions) {
      setPermissions({
        tenant_admin: DEFAULT_PERMISSIONS.tenant_admin,
        cashier: { ...DEFAULT_PERMISSIONS.cashier, ...(settings.permissions as PermissionsConfig).cashier },
        washer: { ...DEFAULT_PERMISSIONS.washer, ...(settings.permissions as PermissionsConfig).washer },
      });
    }
    const settingsObj = t.settings as Record<string, unknown> | null;
    if (settingsObj?.schedule) {
      setSchedule({ ...DEFAULT_SCHEDULE, ...(settingsObj.schedule as WeekSchedule) });
    }
  }, [tenantSettings]);

  const updateMutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSave() {
    const currentSettings = (tenantSettings as Record<string, unknown>)?.settings as Record<string, unknown> ?? {};
    updateMutation.mutate({
      name,
      description,
      address,
      phone,
      business_type: businessType,
      brand_theme: brandTheme,
      logo_url: logoUrl || undefined,
      cover_url: coverUrl || undefined,
      social_links: socialLinks,
      custom_fields: customFields,
      settings: {
        ...currentSettings,
        schedule,
      },
    });
  }

  // Gallery
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);

  const { data: galleryImages = [] } = useQuery({
    queryKey: ['tenant-images'],
    queryFn: getTenantImages,
  });

  const addImageMutation = useMutation({
    mutationFn: addTenantImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-images'] });
      setShowGalleryUpload(false);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: deleteTenantImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-images'] });
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ['availability-blocks'],
    queryFn: getAvailabilityBlocks,
  });

  const deleteBlockMutation = useMutation({
    mutationFn: deleteAvailabilityBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
    },
  });

  function handleAddBlock() {
    if (!blockDate) return;
    createAvailabilityBlock({
      date: blockDate,
      start_time: blockAllDay ? null : (blockStartTime || null),
      end_time: blockAllDay ? null : (blockEndTime || null),
      reason: blockReason || null,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
      setBlockDate('');
      setBlockStartTime('');
      setBlockEndTime('');
      setBlockReason('');
      setBlockAllDay(true);
    });
  }

  function addCustomField() {
    setCustomFields((prev) => [
      ...prev,
      {
        key: `field_${Date.now()}`,
        label: '',
        type: 'text',
        required: false,
        options: null,
      },
    ]);
  }

  function updateCustomField(index: number, updates: Partial<CustomField>) {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    );
  }

  function handlePermClick(role: string, section: string) {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [section]: cyclePermission(prev[role]?.[section as keyof RolePermissions] ?? 'none'),
      },
    }));
  }

  async function handleSavePermissions() {
    setSavingPerms(true);
    setPermsSaved(false);
    try {
      // Save permissions inside settings.permissions
      const currentSettings = (tenantSettings as Record<string, unknown>)?.settings as Record<string, unknown> ?? {};
      await updateTenantSettings({
        settings: {
          ...currentSettings,
          permissions: {
            cashier: permissions.cashier,
            washer: permissions.washer,
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setPermsSaved(true);
      setTimeout(() => setPermsSaved(false), 3000);
    } finally {
      setSavingPerms(false);
    }
  }

  function removeCustomField(index: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  }

  const FIELD_TYPES = [
    { value: 'text', label: 'Texto' },
    { value: 'number', label: 'Número' },
    { value: 'textarea', label: 'Área de texto' },
    { value: 'select', label: 'Selección' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500">Ajustes del negocio</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando configuración...</div>
      ) : (
        <>
          {/* Section 1: Business Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información del negocio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Logo del negocio</label>
                  <ImageUpload
                    currentUrl={logoUrl || null}
                    folder="logos"
                    label="Logo del negocio"
                    rounded
                    onUpload={(url) => setLogoUrl(url)}
                    onRemove={() => setLogoUrl('')}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Imagen de portada</label>
                  <ImageUpload
                    currentUrl={coverUrl || null}
                    folder="covers"
                    label="Imagen de portada"
                    onUpload={(url) => setCoverUrl(url)}
                    onRemove={() => setCoverUrl('')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nombre</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del negocio"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Tipo de negocio</label>
                  <Select value={businessType} onValueChange={(v) => v && setBusinessType(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo">
                        {BUSINESS_TYPES.find(bt => bt.value === businessType)?.label ?? 'Seleccionar tipo'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((bt) => (
                        <SelectItem key={bt.value} value={bt.value}>
                          {bt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe tu negocio..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Dirección</label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección del negocio"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Teléfono</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Brand Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Colores de marca</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                {BRAND_THEMES.map((theme) => (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => setBrandTheme(theme.value)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-10 h-10 rounded-full transition-all ${
                        brandTheme === theme.value
                          ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: theme.primary }}
                    />
                    <span className="text-xs text-gray-600">{theme.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>Redes sociales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Instagram</label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 h-9 border border-r-0 border-gray-200 rounded-l-md bg-gray-50 text-gray-500 text-sm">
                    @
                  </span>
                  <Input
                    className="rounded-l-none"
                    value={socialLinks.instagram}
                    onChange={(e) =>
                      setSocialLinks((prev) => ({ ...prev, instagram: e.target.value }))
                    }
                    placeholder="tu_negocio"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Facebook</label>
                <Input
                  value={socialLinks.facebook}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({ ...prev, facebook: e.target.value }))
                  }
                  placeholder="https://facebook.com/tu_negocio"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">WhatsApp</label>
                <Input
                  value={socialLinks.whatsapp}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({ ...prev, whatsapp: e.target.value }))
                  }
                  placeholder="+1 234 567 890"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section: Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Horarios de atención</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAYS.map((day) => {
                const daySchedule = schedule[day.key];
                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-28">
                      <input
                        type="checkbox"
                        checked={daySchedule.active}
                        onChange={(e) =>
                          setSchedule((prev) => ({
                            ...prev,
                            [day.key]: {
                              ...prev[day.key],
                              active: e.target.checked,
                              open: e.target.checked ? (prev[day.key].open ?? '08:00') : null,
                              close: e.target.checked ? (prev[day.key].close ?? '18:00') : null,
                            },
                          }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-[#343C6A]">{day.label}</span>
                    </label>
                    {daySchedule.active ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={daySchedule.open ?? '08:00'}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              [day.key]: { ...prev[day.key], open: e.target.value },
                            }))
                          }
                          className="w-32"
                        />
                        <span className="text-sm text-[#718EBF]">a</span>
                        <Input
                          type="time"
                          value={daySchedule.close ?? '18:00'}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              [day.key]: { ...prev[day.key], close: e.target.value },
                            }))
                          }
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-[#718EBF]">Cerrado</span>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-[#718EBF] mt-2">
                Los horarios se guardan con el botón &quot;Guardar cambios&quot; al final.
              </p>
            </CardContent>
          </Card>

          {/* Section: Availability Blocks */}
          <Card>
            <CardHeader>
              <CardTitle>Bloqueos excepcionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(blocks as AvailabilityBlock[]).length > 0 && (
                <div className="space-y-2">
                  {(blocks as AvailabilityBlock[]).map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#343C6A]">
                          {new Date(block.date).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        <span className="text-sm text-[#718EBF]">
                          {block.start_time && block.end_time
                            ? `${block.start_time.slice(0, 5)} - ${block.end_time.slice(0, 5)}`
                            : 'Todo el día'}
                        </span>
                        {block.reason && (
                          <span className="text-sm text-[#718EBF]">&mdash; {block.reason}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBlockMutation.mutate(block.id)}
                        disabled={deleteBlockMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {(blocks as AvailabilityBlock[]).length === 0 && (
                <p className="text-sm text-[#718EBF] text-center py-2">
                  No hay bloqueos configurados.
                </p>
              )}

              <div className="border border-[#DFE5EE] rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-[#343C6A]">Agregar bloqueo</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-[#718EBF]">Fecha</label>
                    <Input
                      type="date"
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#343C6A] pb-2">
                    <input
                      type="checkbox"
                      checked={blockAllDay}
                      onChange={(e) => setBlockAllDay(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Todo el día
                  </label>
                  {!blockAllDay && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-[#718EBF]">Desde</label>
                        <Input
                          type="time"
                          value={blockStartTime}
                          onChange={(e) => setBlockStartTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#718EBF]">Hasta</label>
                        <Input
                          type="time"
                          value={blockEndTime}
                          onChange={(e) => setBlockEndTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1 flex-1 min-w-[150px]">
                    <label className="text-xs text-[#718EBF]">Motivo (opcional)</label>
                    <Input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Ej: Feriado, mantenimiento..."
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddBlock}
                    disabled={!blockDate}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Gallery */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Galeria de fotos</CardTitle>
              <span className="text-sm text-muted-foreground">{galleryImages.length}/10 fotos</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {galleryImages.map((img: TenantImage) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group">
                      <Image
                        src={img.url}
                        alt={img.caption ?? 'Foto de galeria'}
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => deleteImageMutation.mutate(img.id)}
                        disabled={deleteImageMutation.isPending}
                        className="absolute top-2 right-2 z-10 flex items-center justify-center size-6 rounded-full bg-destructive text-destructive-foreground shadow opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-90"
                        aria-label="Eliminar foto"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {galleryImages.length === 0 && !showGalleryUpload && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay fotos en la galeria. Agrega hasta 10 fotos de tu negocio.
                </p>
              )}
              {showGalleryUpload ? (
                <div className="space-y-2">
                  <ImageUpload
                    folder="gallery"
                    label="Seleccionar foto"
                    onUpload={(url) => addImageMutation.mutate({ url })}
                    onRemove={() => setShowGalleryUpload(false)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGalleryUpload(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGalleryUpload(true)}
                  disabled={galleryImages.length >= 10}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar foto
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Custom Fields */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Campos del cliente</CardTitle>
              <Button variant="outline" size="sm" onClick={addCustomField}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar campo
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {customFields.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay campos personalizados. Agrega uno para recopilar información adicional de tus clientes.
                </p>
              )}
              {customFields.map((field, index) => (
                <div
                  key={field.key}
                  className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={field.label}
                      onChange={(e) => updateCustomField(index, { label: e.target.value })}
                      placeholder="Nombre del campo"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(val) => val && updateCustomField(index, { type: val, options: val === 'select' ? [] : null })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          {FIELD_TYPES.find(ft => ft.value === field.type)?.label ?? field.type}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateCustomField(index, { required: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      Requerido
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomField(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {field.type === 'select' && (
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Opciones (separadas por coma)</label>
                      <Input
                        value={(field.options ?? []).join(', ')}
                        onChange={(e) =>
                          updateCustomField(index, {
                            options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Opción 1, Opción 2, Opción 3"
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <p className="text-sm text-green-600">Cambios guardados correctamente.</p>
            )}
            {updateMutation.isError && (
              <p className="text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
            )}
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>

          {/* Roles & Permissions — Editable */}
          <Card>
            <CardHeader>
              <CardTitle>Permisos por rol</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Haz click en cada icono para cambiar el permiso. Admin siempre tiene acceso completo.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-gray-700">Sección</th>
                      <th className="text-center py-2 px-3 font-medium text-purple-700">Admin</th>
                      {permEditable.map((r) => (
                        <th key={r.key} className={`text-center py-2 px-3 font-medium ${r.color}`}>{r.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permSections.map((sec) => (
                      <tr key={sec.key} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-gray-700">{sec.label}</td>
                        <td className="text-center py-2 px-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
                        </td>
                        {permEditable.map((role) => {
                          const perm = permissions[role.key]?.[sec.key as keyof typeof permissions.cashier] ?? 'none';
                          return (
                            <td key={role.key} className="text-center py-2 px-3">
                              <button
                                type="button"
                                onClick={() => handlePermClick(role.key, sec.key)}
                                className="cursor-pointer hover:scale-110 transition-transform"
                                title={`Click para cambiar: ${perm === 'full' ? 'Acceso completo' : perm === 'view' ? 'Solo ver' : 'Sin acceso'}`}
                              >
                                {perm === 'full' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>}
                                {perm === 'view' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 text-xs font-bold">◉</span>}
                                {perm === 'none' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs">✕</span>}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-100 border border-green-300" /> Acceso completo</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300" /> Solo ver</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-gray-100 border border-gray-300" /> Sin acceso</span>
                </div>
                <Button size="sm" onClick={handleSavePermissions} disabled={savingPerms}>
                  {savingPerms ? 'Guardando...' : 'Guardar permisos'}
                </Button>
              </div>
              {permsSaved && <p className="text-sm text-green-600 mt-2">Permisos guardados.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
