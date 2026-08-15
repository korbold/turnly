'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useCreateClient, useUpdateClient } from '@/presentation/hooks/use-clients';
import type { ClientResource } from '@/domain/entities/client-resource';
import type { CustomField } from '@/domain/entities/tenant';

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  client?: ClientResource | null;
}

export function ClientForm({ open, onClose, client }: ClientFormProps) {
  const { data: settings } = useSettings();
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const customFields = settings?.customFields ?? [];
  const isEditing = !!client;

  // Tenants that configured no name field (car wash: placa/marca/color)
  // still need a way to name the owner — otherwise the record can never
  // stop being anonymous. Mirrors the backend's `nombre` convention.
  const hasNameField = customFields.some((f) => {
    const label = f.label?.toLowerCase() ?? '';
    return f.key === 'nombre' || (label.includes('nombre') && label.includes('cliente'));
  });

  const form = useForm<Record<string, unknown>>({
    defaultValues: {},
  });

  useEffect(() => {
    if (client) {
      // Merge all data sources: top-level fields + data bag
      const values: Record<string, unknown> = {
        ...(client.data as Record<string, unknown> ?? {}),
      };
      // Map known top-level fields into the custom field keys if they match
      if (client.plate) values['plate'] = client.plate;
      if (client.brand) values['brand'] = client.brand;
      if (client.model) values['model'] = client.model;
      if (client.color) values['color'] = client.color;
      if (client.type) values['type'] = client.type;
      // Seed the fallback name input with the linked client so editing
      // an owned record doesn't look like the name was lost.
      if (!values['nombre'] && client.client?.name) values['nombre'] = client.client.name;
      form.reset(values);
    } else {
      form.reset({});
    }
  }, [client, form]);

  function handleClose() {
    form.reset({});
    onClose();
  }

  function onSubmit(values: Record<string, unknown>) {
    // Separate known DB columns from custom data
    const { plate, brand, model, color, type, ...rest } = values;
    const payload = {
      plate: (plate as string) || undefined,
      brand: (brand as string) || undefined,
      model: (model as string) || undefined,
      color: (color as string) || undefined,
      type: (type as string) || undefined,
      data: Object.keys(rest).length > 0 ? rest : undefined,
    };

    if (isEditing && client) {
      updateMutation.mutate(
        { id: client.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Cliente actualizado');
            handleClose();
          },
          onError: () => toast.error('Error al actualizar'),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Cliente creado');
          handleClose();
        },
        onError: () => toast.error('Error al crear'),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  function renderField(field: CustomField) {
    const fieldName = field.key;
    switch (field.type) {
      case 'textarea':
        return (
          <div key={fieldName} className="col-span-2">
            <Label className="mb-1.5">{field.label}</Label>
            <Textarea
              {...form.register(fieldName)}
              placeholder={field.label}
              rows={2}
            />
          </div>
        );
      case 'select':
        return (
          <div key={fieldName}>
            <Label className="mb-1.5">{field.label}</Label>
            <Select
              value={(form.watch(fieldName) as string) ?? ''}
              onValueChange={(v) => form.setValue(fieldName, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Seleccionar ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'number':
        return (
          <div key={fieldName}>
            <Label className="mb-1.5">{field.label}</Label>
            <Input
              type="number"
              {...form.register(fieldName, { valueAsNumber: true })}
              placeholder={field.label}
            />
          </div>
        );
      default:
        return (
          <div key={fieldName}>
            <Label className="mb-1.5">{field.label}</Label>
            <Input
              {...form.register(fieldName)}
              placeholder={field.label}
            />
          </div>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualiza la información del cliente' : 'Agrega un nuevo recurso/cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {customFields.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {!hasNameField && (
                <div className="col-span-2">
                  <Label className="mb-1.5">
                    Nombre del cliente{' '}
                    <span className="font-normal text-[var(--fg-muted)]">(opcional)</span>
                  </Label>
                  <Input {...form.register('nombre')} placeholder="Ej. Marta Ruiz" />
                </div>
              )}
              {customFields.map(renderField)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay campos configurados. Ve a Configuración → Campos para definir los datos del cliente.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || customFields.length === 0}>
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
