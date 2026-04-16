'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { useUpdateService, useDeleteService } from '@/presentation/hooks/use-services';
import type { Service } from '@/domain/entities/service';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v);

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
}

export function ServiceCard({ service, onEdit }: ServiceCardProps) {
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();

  function handleToggleActive() {
    updateMutation.mutate(
      { id: service.id, data: { isActive: !service.isActive } },
      {
        onSuccess: () =>
          toast.success(service.isActive ? 'Servicio desactivado' : 'Servicio activado'),
        onError: () => toast.error('Error al actualizar'),
      }
    );
  }

  function handleDelete() {
    if (!confirm('Eliminar este servicio?')) return;
    deleteMutation.mutate(service.id, {
      onSuccess: () => toast.success('Servicio eliminado'),
      onError: () => toast.error('Error al eliminar'),
    });
  }

  return (
    <motion.div whileHover={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
      <Card className="overflow-hidden transition-shadow">
        {/* Image or placeholder */}
        {service.imageUrl ? (
          <div className="relative h-36 w-full">
            <img
              src={service.imageUrl}
              alt={service.name}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-zinc-100">
            <ImageIcon className="h-10 w-10 text-zinc-300" />
          </div>
        )}

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{service.name}</p>
              <p className="text-lg font-bold text-indigo-600">{fmt(service.price)}</p>
              {service.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {service.description}
                </p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(service)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-rose-600" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Badge
              className={cn(
                'border-0 text-[10px]',
                service.isActive
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-zinc-100 text-zinc-500'
              )}
            >
              {service.isActive ? 'Activo' : 'Inactivo'}
            </Badge>

            {/* Toggle switch (custom since no switch component) */}
            <button
              type="button"
              role="switch"
              aria-checked={service.isActive}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                service.isActive ? 'bg-indigo-500' : 'bg-zinc-300'
              )}
              onClick={handleToggleActive}
              disabled={updateMutation.isPending}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform',
                  service.isActive ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
