'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { MoreHorizontal, CheckCircle2, Pencil, Trash2, Plus, ClipboardList, Wallet, Play, Trophy, FileText, Receipt, Eye, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { apiErrorMessage } from '@/shared/utils/api-error';
import {
  useServiceLogs,
  useCompleteServiceLog,
  useDeleteServiceLog,
} from '@/presentation/hooks/use-service-logs';
import { PAYMENT_METHOD_CONFIG } from '@/shared/constants/status';
import { RegisterPaymentDialog } from '@/presentation/components/features/service-logs/register-payment-dialog';
import { FiscalProfileDialog } from '@/presentation/components/features/service-logs/fiscal-profile-dialog';
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { useEmitInvoice } from '@/presentation/hooks/use-invoices';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import type { ServiceLog, ServiceLogStatus, PaymentFilter, PageSize } from '@/domain/entities/service-log';

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
  payment?: PaymentFilter;
  status?: 'in_progress' | 'completed';
  q?: string;
  page?: number;
  perPage?: PageSize;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (size: PageSize) => void;
  onEdit?: (log: ServiceLog) => void;
  onCreate?: () => void;
  /** Dashboard preview: no pager, no size selector — the full list is a click away. */
  compact?: boolean;
}

export function LogList({
  date,
  payment,
  status,
  q,
  page = 1,
  perPage = '15',
  onPageChange,
  onPerPageChange,
  onEdit,
  onCreate,
  compact = false,
}: LogListProps) {
  const router = useRouter();
  const { data, isLoading } = useServiceLogs({ date, payment, status, q, page, perPage });
  const completeMutation = useCompleteServiceLog();
  const deleteMutation = useDeleteServiceLog();
  const emitInvoiceMutation = useEmitInvoice();
  // Erasing a service is granted per role in Configuración → Permisos
  // (default: Admin only). A cashier without it asks instead. The backend
  // reads the same matrix.
  const { canDeleteLog } = usePermissions();
  const [payTarget, setPayTarget] = useState<ServiceLog | null>(null);
  const [billingTarget, setBillingTarget] = useState<ServiceLog | null>(null);

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const lastPage = data?.meta?.lastPage ?? 1;
  const currentPage = data?.meta?.currentPage ?? 1;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * (data?.meta?.perPage ?? 0) + 1;
  const rangeEnd = Math.min(rangeStart + logs.length - 1, total);

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
      onError: (e) => toast.error(apiErrorMessage(e, 'Error al eliminar')),
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
    // An empty result under a filter is not an empty day — saying "aún no
    // registras servicios" there reads as data loss, and offering to create a
    // service is the wrong next step when the row probably exists unfiltered.
    const filtered = !!payment || !!status || !!q?.trim();

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
          <ClipboardList className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
          {filtered ? 'Sin resultados para este filtro' : 'Aún no registras servicios hoy'}
        </p>
        <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
          {filtered
            ? 'Prueba con otra búsqueda o limpia los filtros para ver todo el día.'
            : 'Cada vez que completes un servicio, anótalo aquí para llevar caja del día.'}
        </p>
        {onCreate && !filtered && (
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
        const inProgress = log.status === 'in_progress';
        // The row carries both axes at once: blue for work still open (the
        // "En progreso" badge's own colour), amber for money still owed (the
        // "Sin cobrar" tile's). A row that is both fades one into the other
        // rather than picking a winner. Done and paid stays plain — nothing
        // left to do on it.
        const rowTint = inProgress
          ? isUnpaid
            ? 'border-[var(--warning-200)] bg-gradient-to-r from-[var(--status-progress-bg)] to-[var(--warning-50)] hover:from-[var(--info-200)] hover:to-[var(--warning-100)]'
            : 'border-[var(--info-200)] bg-[var(--status-progress-bg)] hover:bg-[var(--info-200)]'
          : isUnpaid
            ? 'border-[var(--warning-200)] bg-[var(--warning-50)] hover:bg-[var(--warning-100)]'
            : 'border-[var(--border)] bg-white hover:bg-[var(--bg-sunken)]/40';
        // Recurso = the vehicle/resource, never the client name (the client
        // has its own column/sub-line). Prefer the composed label, then plate.
        const recursoLabel =
          log.clientResource?.label ||
          log.clientResource?.plate ||
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
              'rounded-lg border p-3 transition-colors',
              'lg:grid lg:grid-cols-[60px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_84px_112px_minmax(280px,auto)] lg:items-center lg:gap-3',
              rowTint,
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
                  {log.invoiceStatus !== 'autorizada' && (() => {
                    // Spinner stays up from the click through the SRI verdict:
                    // the mutation covers click→"enviada"; invoiceStatus
                    // 'enviada' covers "enviada"→autorizada/rechazada (the list
                    // polls meanwhile). FEDER-style immediate rejection settles
                    // the mutation straight to 'rechazada' (never 'enviada').
                    const isEmitting =
                      (emitInvoiceMutation.isPending && emitInvoiceMutation.variables === log.id) ||
                      log.invoiceStatus === 'enviada';
                    const isRetry = log.invoiceStatus === 'rechazada';
                    return (
                      <Button
                        size="sm"
                        onClick={() =>
                          emitInvoiceMutation.mutate(log.id, {
                            onSuccess: () => toast.success('Facturación iniciada'),
                            onError: (e) => toast.error(apiErrorMessage(e, 'Error al iniciar facturación'), { duration: 8000 }),
                          })
                        }
                        disabled={isEmitting}
                        className="h-9 shrink-0 cursor-pointer gap-1.5 bg-[var(--info-500)] px-3 text-white hover:bg-[var(--info-700)] disabled:opacity-100"
                      >
                        {isEmitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {isEmitting
                          ? isRetry
                            ? 'Reintentando…'
                            : 'Facturando…'
                          : isRetry
                            ? 'Reintentar factura'
                            : 'Facturar'}
                      </Button>
                    );
                  })()}
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
                  <DropdownMenuItem onClick={() => router.push(`/service-logs/${log.id}`)}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Ver detalle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                  {/* Facturar itself is a visible row button (see the
                      primary-actions block above). This is the occasional
                      correction path for the client's fiscal data. */}
                  {log.clientResource?.client && (
                    <DropdownMenuItem onClick={() => setBillingTarget(log)}>
                      <Receipt className="mr-2 h-3.5 w-3.5" />
                      Datos de facturación
                    </DropdownMenuItem>
                  )}
                  {/* A paid or invoiced log is a financial/fiscal record —
                      deletion is blocked (backend enforces too), and even an
                      unpaid one needs the Eliminar privilege. */}
                  {canDeleteLog && log.paymentStatus !== 'paid' && log.invoiceStatus === null && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-[var(--status-cancelled-fg)] focus:bg-[var(--status-cancelled-bg)] focus:text-[var(--status-cancelled-fg)]"
                        onClick={() => handleDelete(log.id)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        );
      })}

      {/* Pager. The size selector stays put even on a single page — it is how
          the cashier asks for "Todos" — while the prev/next pair only appears
          when there is somewhere to go. */}
      {!compact && (
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-[var(--fg-muted)]">
          {total === 0
            ? 'Sin registros'
            : `Mostrando ${rangeStart}–${rangeEnd} de ${total}`}
        </p>

        <div className="flex items-center gap-2">
          {lastPage > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Página anterior"
                disabled={currentPage <= 1}
                onClick={() => onPageChange?.(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="px-1 text-[12px] tabular-nums text-[var(--fg-secondary)]">
                {currentPage} / {lastPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Página siguiente"
                disabled={currentPage >= lastPage}
                onClick={() => onPageChange?.(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          <Select value={perPage} onValueChange={(v) => onPerPageChange?.(v as PageSize)}>
            <SelectTrigger className="h-8 w-[104px]" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 filas</SelectItem>
              <SelectItem value="15">15 filas</SelectItem>
              <SelectItem value="20">20 filas</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      )}

      {/* Pago dialog — triggered from the unpaid rows' overflow menu. */}
      {payTarget && (
        <RegisterPaymentDialog
          serviceLogId={payTarget.id}
          total={payTarget.priceCharged}
          open
          onClose={() => setPayTarget(null)}
        />
      )}

      {/* Datos de facturación — occasional fiscal-data correction. */}
      {billingTarget && (
        <FiscalProfileDialog
          serviceLogId={billingTarget.id}
          clientName={billingTarget.clientResource?.client?.name}
          open
          onClose={() => setBillingTarget(null)}
        />
      )}
    </div>
  );
}
