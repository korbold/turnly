'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, CheckCircle2, Pencil, Trash2, Plus, ClipboardList, Wallet, Play, Trophy, FileText } from 'lucide-react';
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
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { useEmitInvoice } from '@/presentation/hooks/use-invoices';
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
  const emitInvoiceMutation = useEmitInvoice();
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
      {/* Desktop header — proportions match the row grid below. The
          last slot (estado + acciones) is wider than before because
          the "Cobrar"/"Completar" labeled buttons no longer fit in
          180px next to the status badge + overflow ⋯, which was
          clipping them at the right edge. */}
      <div className="hidden rounded-lg bg-[var(--bg-sunken)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)] lg:grid lg:grid-cols-[60px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_84px_112px_minmax(280px,auto)] lg:gap-3 lg:items-center">
        <span>Hora</span>
        <span>Recurso</span>
        <span>Servicio</span>
        <span>Empleado</span>
        <span className="text-right">Precio</span>
        <span>Pago</span>
        <span className="text-right">Estado · Acciones</span>
      </div>

      {logs.map((log, idx) => {
        const statusCfg = STATUS_CONFIG[log.status];
        const pmCfg = log.paymentMethod ? PAYMENT_METHOD_CONFIG[log.paymentMethod] : null;
        const isUnpaid = log.paymentStatus === 'unpaid';
        const recursoLabel =
          log.clientResource?.plate ||
          log.clientResource?.client?.name ||
          log.clientResource?.label ||
          'Sin recurso';
        const serviceLabel = (() => {
          const summary = log.servicesSummary;
          if (summary && summary.count > 1) {
            const head = summary.labels[0] ?? log.service?.name ?? '';
            const extra = summary.count - 1;
            return `${head} +${extra} más`;
          }
          return summary?.labels[0] ?? log.service?.name ?? 'N/A';
        })();

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className={cn(
              'rounded-lg border border-[var(--border)] bg-white p-3 transition-colors hover:bg-[var(--bg-sunken)]/40',
              'lg:grid lg:grid-cols-[60px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_84px_112px_minmax(280px,auto)] lg:items-center lg:gap-3',
            )}
          >
            {/* Hora — bigger weight on mobile to read like a chip,
                lighter on desktop where the column header carries it. */}
            <span className="block font-mono text-[14px] font-semibold tabular-nums text-[var(--fg-strong)] lg:font-normal" style={{ fontFamily: 'var(--font-mono)' }}>
              {format(new Date(log.startedAt), 'HH:mm')}
            </span>

            {/* Recurso */}
            <div className="mt-2 lg:mt-0">
              <p className="truncate text-[13.5px] font-medium text-[var(--fg-strong)]" title={recursoLabel}>
                {recursoLabel}
              </p>
              {log.clientResource?.client?.name && log.clientResource?.plate && (
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)] lg:hidden">
                  {log.clientResource.client.name}
                </p>
              )}
            </div>

            {/* Servicio */}
            <div className="mt-1 lg:mt-0">
              <p className="truncate text-[13.5px] text-[var(--fg-strong)]" title={serviceLabel}>
                {serviceLabel}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)] lg:hidden">
                {log.attendant?.name ?? '-'}
              </p>
            </div>

            {/* Empleado (desktop only — moved into the servicio sub-line
                on mobile so the row stays compact). */}
            <span className="hidden truncate text-[13px] text-[var(--fg-secondary)] lg:inline">
              {log.attendant?.name ?? '-'}
            </span>

            {/* Precio */}
            <span
              className="mt-2 block font-mono text-[15px] font-semibold tabular-nums text-[var(--fg-strong)] lg:mt-0 lg:text-right lg:text-[14px]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {fmt(log.priceCharged)}
            </span>

            {/* Pago */}
            <div className="mt-2 lg:mt-0">
              {isUnpaid ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  Pendiente
                </span>
              ) : pmCfg ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-sunken)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--fg-strong)]">
                  <span aria-hidden="true">{pmCfg.icon}</span>
                  {pmCfg.label}
                </span>
              ) : (
                <span className="text-[12px] text-[var(--fg-muted)]">—</span>
              )}
            </div>

            {/* Estado + acciones — primary action gets a labeled
                button (40px target) so PWA taps land cleanly. Overflow
                ⋯ keeps editar/eliminar. `flex-nowrap + shrink-0` on the
                primary CTA so it never clips at intermediate breakpoints
                (the bug that made the Cobrar button only show on
                hover). */}
            <div className="mt-3 flex flex-nowrap items-center justify-end gap-2 lg:mt-0">
              <InvoiceStatusBadge status={log.invoiceStatus} className="ml-1" />

              <Badge
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap border-0 px-2.5 py-1 text-[11.5px] font-semibold',
                  statusCfg.bg,
                  statusCfg.color,
                )}
              >
                {log.status === 'in_progress' ? (
                  <Play className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Trophy className="h-3 w-3" aria-hidden="true" />
                )}
                {statusCfg.label}
              </Badge>

              {/* Primary actions — surfaced as labeled buttons so the
                  cashier doesn't fish for icons. Unpaid → Cobrar. Once paid,
                  facturación is a manual step: Completar (while in progress)
                  and Facturar (until the SRI invoice is autorizada) can both
                  show. */}
              {isUnpaid ? (
                <Button
                  size="sm"
                  onClick={() => setPayTarget(log)}
                  className="h-9 shrink-0 cursor-pointer gap-1.5 bg-[var(--warning-600)] px-3 text-white hover:bg-[var(--warning-700)]"
                >
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                  Cobrar
                </Button>
              ) : (
                <>
                  {log.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleComplete(log.id)}
                      disabled={completeMutation.isPending}
                      className="h-9 shrink-0 cursor-pointer gap-1.5 border-[var(--success-200)] px-3 text-[var(--success-700)] hover:bg-[var(--success-50)] hover:text-[var(--success-800)]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Completar
                    </Button>
                  )}
                  {log.invoiceStatus !== 'autorizada' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        emitInvoiceMutation.mutate(log.id, {
                          onSuccess: () => toast.success('Facturación iniciada'),
                          onError: () => toast.error('Error al iniciar facturación'),
                        })
                      }
                      disabled={emitInvoiceMutation.isPending}
                      className="h-9 shrink-0 cursor-pointer gap-1.5 bg-[var(--info-500)] px-3 text-white hover:bg-[var(--info-700)]"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {log.invoiceStatus === 'rechazada' ? 'Reintentar factura' : 'Facturar'}
                    </Button>
                  )}
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Más acciones"
                    className="h-9 w-9 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)]"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  {log.status === 'in_progress' && (
                    <>
                      <DropdownMenuItem onClick={() => handleComplete(log.id)} disabled={completeMutation.isPending}>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Completar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => onEdit?.(log)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </DropdownMenuItem>
                  {/* Facturar moved out to a visible row button (see the
                      primary-actions block above); kebab keeps edit/delete. */}
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
