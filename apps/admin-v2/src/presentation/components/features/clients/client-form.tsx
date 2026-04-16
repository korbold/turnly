'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

// Base schema - custom fields added dynamically
const baseSchema = z.object({
  plate: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  type: z.string().optional(),
});

type FormValues = z.infer<typeof baseSchema> & Record<string, unknown>;

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

  const form = useForm<FormValues>({
    defaultValues: {
      plate: '',
      brand: '',
      model: '',
      color: '',
      type: '',
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        plate: client.plate ?? '',
        brand: client.brand ?? '',
        model: client.model ?? '',
        color: client.color ?? '',
        type: client.type ?? '',
        ...(client.data as Record<string, unknown> ?? {}),
      });
    } else {
      form.reset({
        plate: '',
        brand: '',
        model: '',
        color: '',
        type: '',
      });
    }
  }, [client, form]);

  function handleClose() {
    form.reset();
    onClose();
  }

  function onSubmit(values: FormValues) {
    const { plate, brand, model, color, type, ...customData } = values;
    const payload = {
      plate: plate || undefined,
      brand: brand || undefined,
      model: model || undefined,
      color: color || undefined,
      type: type || undefined,
      data: Object.keys(customData).length > 0 ? customData : undefined,
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

  function renderCustomField(field: CustomField) {
    const fieldName = field.key;
    switch (field.type) {
      case 'textarea':
        return (
          <div key={fieldName}>
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
            {isEditing ? 'Actualiza la informacion del cliente' : 'Agrega un nuevo recurso/cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Base fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5">Placa</Label>
              <Input {...form.register('plate')} placeholder="ABC-123" />
            </div>
            <div>
              <Label className="mb-1.5">Marca</Label>
              <Input {...form.register('brand')} placeholder="Toyota" />
            </div>
            <div>
              <Label className="mb-1.5">Modelo</Label>
              <Input {...form.register('model')} placeholder="Corolla" />
            </div>
            <div>
              <Label className="mb-1.5">Color</Label>
              <Input {...form.register('color')} placeholder="Blanco" />
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Tipo</Label>
            <Input {...form.register('type')} placeholder="Sedan, SUV, etc." />
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">
                Campos personalizados
              </p>
              {customFields.map(renderCustomField)}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
