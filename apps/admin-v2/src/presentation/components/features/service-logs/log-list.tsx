'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import {
  useServiceLogs,
  useCompleteServiceLog,
  useDeleteServiceLog,
} from '@/presentation/hooks/use-service-logs';
import { PAYMENT_METHOD_CONFIG } from '@/shared/constants/status';
import type { ServiceLog, ServiceLogStatus } from '@/domain/entities/service-log';

const STATUS_CONFIG: Record<ServiceLogStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'En Progreso', color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-muted)]' },
  completed: { label: 'Completado', color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

const fmt = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v);

interface LogListProps {
  date: string;
  onEdit?: (log: ServiceLog) => void;
}

export function LogList({ date, onEdit }: LogListProps) {
  const { data, isLoading } = useServiceLogs({ date });
  const completeMutation = useCompleteServiceLog();
  const deleteMutation = useDeleteServiceLog();

  const logs = data?.data ?? [];

  function handleComplete(id: string) {
    completeMutation.mutate(id, {
      onSuccess: () => toast.success('Servicio completado'),
      onError: () => toast.error('Error al completar'),
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Eliminar este registro?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Registro eliminado'),
      onError: () => toast.error('Error al eliminar'),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No hay registros de servicio para esta fecha
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Desktop header */}
      <div className="hidden rounded-lg bg-zinc-50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-7 sm:gap-3">
        <span>Hora</span>
        <span>Recurso</span>
        <span>Servicio</span>
        <span>Empleado</span>
        <span>Precio</span>
        <span>Pago</span>
        <span>Estado</span>
      </div>

      {logs.map((log, idx) => {
        const statusCfg = STATUS_CONFIG[log.status];
        const pmCfg = PAYMENT_METHOD_CONFIG[log.paymentMethod];

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="rounded-lg border bg-white p-4 sm:grid sm:grid-cols-7 sm:items-center sm:gap-3 sm:p-3"
          >
            {/* Mobile layout uses stacked, desktop uses grid */}
            <span className="text-sm font-medium sm:font-normal">
              {format(new Date(log.startedAt), 'HH:mm')}
            </span>

            <span className="text-sm">
              {log.clientResource?.plate ?? 'N/A'}
            </span>

            <span className="text-sm">
              {log.service?.name ?? 'N/A'}
            </span>

            <span className="text-sm text-muted-foreground">
              {log.attendant?.name ?? '-'}
            </span>

            <span className="text-sm font-medium">
              {fmt(log.priceCharged)}
            </span>

            <span className="text-xs">
              {pmCfg?.icon} {pmCfg?.label ?? log.paymentMethod}
            </span>

            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Badge className={cn('border-0 text-[10px]', statusCfg.bg, statusCfg.color)}>
                {statusCfg.label}
              </Badge>

              <div className="flex items-center gap-1">
                {log.status === 'in_progress' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                    onClick={() => handleComplete(log.id)}
                    disabled={completeMutation.isPending}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Completar
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(log)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-rose-600"
                      onClick={() => handleDelete(log.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
