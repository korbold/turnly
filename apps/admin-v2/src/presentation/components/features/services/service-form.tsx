'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';


import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
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
          onError: () => toast.error('Error al actualizar'),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Servicio creado');
          handleClose();
        },
        onError: () => toast.error('Error al crear'),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const imageUrl = form.watch('imageUrl');

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
            <Label className="mb-1.5">Descripcion (opcional)</Label>
            <Textarea {...form.register('description')} placeholder="Descripcion del servicio..." rows={3} />
          </div>

          {/* Image upload area */}
          <div>
            <Label className="mb-1.5">Imagen (opcional)</Label>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img src={imageUrl} alt="Preview" className="h-36 w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-white/80 p-1 shadow hover:bg-white"
                  onClick={() => form.setValue('imageUrl', '')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6" />
                <span className="text-xs">Click para subir imagen</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Create preview URL - in production would upload via useUpload hook
                  const url = URL.createObjectURL(file);
                  form.setValue('imageUrl', url);
                }
              }}
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
                form.watch('isActive') ? 'bg-indigo-500' : 'bg-zinc-300'
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
            <Button type="submit" disabled={isPending}>
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
