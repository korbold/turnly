'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';
import type { CustomField } from '@/domain/entities/tenant';

const FIELD_TYPES: { value: CustomField['type']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'select', label: 'Seleccion' },
  { value: 'textarea', label: 'Area de texto' },
];

const CAPITALIZE_OPTIONS: { value: NonNullable<CustomField['capitalize']>; label: string }[] = [
  { value: 'none', label: 'Normal' },
  { value: 'uppercase', label: 'MAYÚSCULAS' },
  { value: 'lowercase', label: 'minúsculas' },
  { value: 'capitalize', label: 'Primera Mayúscula' },
];

function newField(): CustomField {
  return {
    key: `field_${Date.now()}`,
    label: '',
    type: 'text',
    required: false,
    options: [],
  };
}

export function CustomFieldsTab() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [fields, setFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (settings?.customFields) {
      setFields(settings.customFields);
    }
  }, [settings]);

  function addField() {
    setFields((prev) => [...prev, newField()]);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateField(idx: number, partial: Partial<CustomField>) {
    setFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...partial } : f))
    );
  }

  function updateOptions(idx: number, optionsStr: string) {
    const options = optionsStr.split(',').map((s) => s.trim()).filter(Boolean);
    updateField(idx, { options });
  }

  async function handleSave() {
    try {
      await update.mutateAsync({ customFields: fields });
      toast.success('Campos guardados');
    } catch {
      toast.error('Error al guardar campos');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-[var(--fg-default,#2E3441)]">
            Campos personalizados
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
            Datos extra que el cliente completa al reservar (placa, talla, modelo).
          </p>
        </div>
        <Button size="sm" onClick={addField}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Agregar campo
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)] py-12">
          <p className="text-sm text-[var(--fg-muted)]">Aún no hay campos personalizados.</p>
          <Button variant="link" size="sm" className="text-[var(--brand-700)]" onClick={addField}>
            Agregar el primero
          </Button>
        </div>
      )}

      {fields.map((field, idx) => (
        <Card key={field.key}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <GripVertical className="mt-2 h-4 w-4 shrink-0 text-zinc-400" />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Ej: Placa"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={field.type}
                      onValueChange={(v) => updateField(idx, { type: v as CustomField['type'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Formato</Label>
                    <Select
                      value={field.capitalize ?? 'none'}
                      onValueChange={(v) => updateField(idx, { capitalize: v as CustomField['capitalize'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAPITALIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      Requerido
                    </label>
                  </div>
                </div>

                {field.type === 'select' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Opciones (separadas por coma)</Label>
                    <Input
                      value={field.options?.join(', ') ?? ''}
                      onChange={(e) => updateOptions(idx, e.target.value)}
                      placeholder="Opcion 1, Opcion 2, Opcion 3"
                    />
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeField(idx)} aria-label="Eliminar campo">
                <Trash2 className="h-4 w-4 text-[var(--danger-500)]" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button onClick={handleSave} disabled={update.isPending}>
        <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {update.isPending
          ? 'Guardando...'
          : fields.length === 0
            ? 'Guardar (sin campos)'
            : 'Guardar campos'}
      </Button>
    </div>
  );
}
