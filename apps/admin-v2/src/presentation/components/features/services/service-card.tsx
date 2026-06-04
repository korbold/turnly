'use client';

import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2, Copy, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { useUpdateService, useDeleteService } from '@/presentation/hooks/use-services';
import type { Service } from '@/domain/entities/service';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDuplicate?: (service: Service) => void;
}

export function ServiceCard({ service, onEdit, onDuplicate }: ServiceCardProps) {
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
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-shadow hover:shadow-sm',
        !service.isActive && 'opacity-70'
      )}
    >
      {service.imageUrl && (
        <div className="relative h-32 w-full overflow-hidden bg-[var(--bg-sunken)]">
          <img
            src={service.imageUrl}
            alt={service.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-snug text-[var(--fg-strong)]">
              {service.name}
            </p>
            <p
              className="mt-1 text-[20px] font-bold tabular-nums leading-none text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {fmt(service.price)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Más acciones" className="h-8 w-8 shrink-0 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem onClick={() => onEdit(service)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/services/${service.id}`}>
                  <Layers className="mr-2 h-3.5 w-3.5" />
                  Variantes y receta
                </Link>
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(service)}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Duplicar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--status-cancelled-fg)] focus:bg-[var(--status-cancelled-bg)] focus:text-[var(--status-cancelled-fg)]"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {service.description && (
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-[var(--fg-secondary)]">
            {service.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.04em]',
              service.isActive ? 'text-[var(--status-completed-fg)]' : 'text-[var(--fg-muted)]'
            )}
          >
            {service.isActive ? 'Activo' : 'Pausado'}
          </span>

          <button
            type="button"
            role="switch"
            aria-checked={service.isActive}
            aria-label={service.isActive ? 'Desactivar servicio' : 'Activar servicio'}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60',
              service.isActive ? 'bg-[var(--brand-500)]' : 'bg-[var(--ink-200)]'
            )}
            onClick={handleToggleActive}
            disabled={updateMutation.isPending}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform',
                service.isActive ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </div>
    </article>
  );
}
