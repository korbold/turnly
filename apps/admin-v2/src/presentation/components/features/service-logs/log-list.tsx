'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, CheckCircle2, Pencil, Trash2, Plus, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import {
  useServiceLogs,
  useCompleteServiceLog,
  useDeleteServiceLog,
} from '@/presentation/hooks/use-service-logs';
import { PAYMENT_METHOD_CONFIG } from '@/shared/constants/status';
import { RegisterPaymentDialog } from '@/presentation/components/features/service-logs/register-payment-dialog';
import type { ServiceLog, ServiceLogStatus } from '@/domain/entities/service-log';

const STATUS_CONFIG: Record<ServiceLogStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'En progreso', color: 'text-[var(--status-progress-fg)]', bg: 'bg-[var(--status-progress-bg)]' },
  completed: { label: 'Completado', color: 'text-[var(--status-completed-fg)]', bg: 'bg-[var(--status-completed-bg)]' },
};

const fmt = (v: number) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(v);

interface LogListProps {
  date: string;
  onEdit?: (log: ServiceLog) => void;
  onCreate?: () => void;
}

export function LogList({ date, onEdit, onCreate }: LogListProps) {
  const { data, isLoading } = useServiceLogs({ date });
  const completeMutation = useCompleteServiceLog();
  const deleteMutation = useDeleteServiceLog();
  const [payTarget, setPayTarget] = useState<ServiceLog | null>(null);

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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
          <ClipboardList className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
          Aún no registras servicios hoy
        </p>
        <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
          Cada vez que completes un servicio, anótalo aquí para llevar caja del día.
        </p>
        {onCreate && (
          <Button onClick={onCreate} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Registrar servicio
          </Button>
        )}
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
        // paymentMethod is nullable once "cobrar al retirar" landed —
        // unpaid rows show the pendiente badge instead of a method.
        const pmCfg = log.paymentMethod ? PAYMENT_METHOD_CONFIG[log.paymentMethod] : null;
        const isUnpaid = log.paymentStatus === 'unpaid';

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

            <span className="truncate text-sm">
              {log.clientResource?.plate ||
                log.clientResource?.client?.name ||
                log.clientResource?.label ||
                'Sin recurso'}
            </span>

            <span className="text-sm">
              {(() => {
                // Prefer the multi-service rollup when the log carries
                // items. Falls back to the legacy single-service name
                // for rows that pre-date Fase C or only had one item.
                const summary = log.servicesSummary;
                if (summary && summary.count > 1) {
                  const head = summary.labels[0] ?? log.service?.name ?? '';
                  const extra = summary.count - 1;
                  return `${head} +${extra} más`;
                }
                return summary?.labels[0] ?? log.service?.name ?? 'N/A';
              })()}
            </span>

            <span className="text-sm text-muted-foreground">
              {log.attendant?.name ?? '-'}
            </span>

            <span className="text-sm font-medium">
              {fmt(log.priceCharged)}
            </span>

            <span className="text-xs">
              {isUnpaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-700)]">
                  Pendiente
                </span>
              ) : pmCfg ? (
                <>
                  {pmCfg.icon} {pmCfg.label}
                </>
              ) : (
                <span className="text-[var(--fg-muted)]">—</span>
              )}
            </span>

            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Badge className={cn('whitespace-nowrap border-0 text-[11px] font-semibold', statusCfg.bg, statusCfg.color)}>
                {statusCfg.label}
              </Badge>

              <div className="flex items-center gap-1">
                {log.status === 'in_progress' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Completar"
                    title="Completar"
                    className="h-8 w-8 p-0 text-[var(--status-completed-fg)] hover:bg-[var(--status-completed-bg)] hover:text-[var(--status-completed-fg)]"
                    onClick={() => handleComplete(log.id)}
                    disabled={completeMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label="Más acciones" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[10rem]">
                    {isUnpaid && (
                      <>
                        <DropdownMenuItem onClick={() => setPayTarget(log)}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                          Registrar pago
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => onEdit?.(log)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-[var(--status-cancelled-fg)] focus:bg-[var(--status-cancelled-bg)] focus:text-[var(--status-cancelled-fg)]"
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

      {/* Pago dialog — triggered from the unpaid rows' overflow menu. */}
      {payTarget && (
        <RegisterPaymentDialog
          serviceLogId={payTarget.id}
          total={payTarget.priceCharged}
          open
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}
