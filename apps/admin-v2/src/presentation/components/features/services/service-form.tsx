'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';


import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import api from '@/infrastructure/api/client';
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
import { cn } from '@/shared/utils/cn';
import { useCreateService, useUpdateService } from '@/presentation/hooks/use-services';
import type { Service } from '@/domain/entities/service';

interface FormValues {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder?: number;
}

interface ServiceFormProps {
  open: boolean;
  onClose: () => void;
  service?: Service | null;
}

export function ServiceForm({ open, onClose, service }: ServiceFormProps) {
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isEditing = !!service;

  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      price: 0,
      description: '',
      imageUrl: '',
      isActive: true,
      sortOrder: 0,
    },
  });

  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        price: service.price,
        description: service.description ?? '',
        imageUrl: service.imageUrl ?? '',
        isActive: service.isActive,
        sortOrder: service.sortOrder,
      });
    } else {
      form.reset({
        name: '',
        price: 0,
        description: '',
        imageUrl: '',
        isActive: true,
        sortOrder: 0,
      });
    }
  }, [service, form]);

  function handleClose() {
    form.reset();
    onClose();
  }

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      price: values.price,
      description: values.description || undefined,
      imageUrl: values.imageUrl || undefined,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
    };

    if (isEditing && service) {
      updateMutation.mutate(
        { id: service.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Servicio actualizado');
            handleClose();
          },
          onError: (err: unknown) => {
            const e = err as { message?: string };
            toast.error(e?.message ?? 'Error al actualizar');
          },
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Servicio creado');
          handleClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'Error al crear');
        },
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const imageUrl = form.watch('imageUrl');

  async function handleFileSelected(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen muy grande (máx 5MB)');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'services');
      const { data } = await api.post<{ data: { url: string } }>('/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      form.setValue('imageUrl', data.data.url, { shouldDirty: true });
    } catch {
      toast.error('Error al subir imagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del servicio' : 'Crea un nuevo servicio'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="mb-1.5">Nombre</Label>
            <Input {...form.register('name')} placeholder="Lavado completo" />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-rose-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label className="mb-1.5">Precio</Label>
            <Input type="number" {...form.register('price')} placeholder="0" />
            {form.formState.errors.price && (
              <p className="mt-1 text-xs text-rose-500">{form.formState.errors.price.message}</p>
            )}
          </div>

          <div>
            <Label className="mb-1.5">Descripción (opcional)</Label>
            <Textarea {...form.register('description')} placeholder="Descripción del servicio..." rows={3} />
          </div>

          {/* Image upload area */}
          <div>
            <Label className="mb-1.5">Imagen (opcional)</Label>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Preview" className="h-36 w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-white/80 p-1 shadow hover:bg-white"
                  onClick={() => form.setValue('imageUrl', '', { shouldDirty: true })}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-muted-foreground',
                  uploading
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-muted)]/30'
                )}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs">Subiendo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span className="text-xs">Click para subir imagen</span>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Label>Activo</Label>
            <button
              type="button"
              role="switch"
              aria-checked={form.watch('isActive')}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                form.watch('isActive') ? 'bg-[var(--color-primary)]' : 'bg-zinc-300'
              )}
              onClick={() => form.setValue('isActive', !form.getValues('isActive'))}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform',
                  form.watch('isActive') ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || uploading}>
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
