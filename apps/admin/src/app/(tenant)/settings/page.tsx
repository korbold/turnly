'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTenantSettings, updateTenantSettings } from '@/lib/api/tenant';
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
import { ImageUpload } from '@/components/ui/image-upload';
import { Trash2, Plus } from 'lucide-react';

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
                      <SelectValue placeholder="Seleccionar tipo" />
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

          {/* Section 4: Custom Fields */}
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
                        <SelectValue />
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
        </>
      )}
    </div>
  );
}
