'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Button } from '@/presentation/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/presentation/components/ui/table';
import { useServiceLogs } from '@/presentation/hooks/use-service-logs';
import { PAYMENT_METHOD_CONFIG } from '@/shared/constants/status';
import { formatCurrency } from '@/shared/utils/format';
import type { PageSize, PaymentFilter } from '@/domain/entities/service-log';

interface ServiceLogTableProps {
  from: string;
  to: string;
  paymentMethod?: PaymentFilter | null;
  paymentBank?: string | null;
}

/**
 * The rows behind the report's totals. Read-only on purpose: cobrar, facturar
 * and completar belong to the Registro Diario, and they would print as coloured
 * boxes in the PDF — this table is meant to be handed to an accountant.
 */
export function ServiceLogTable({ from, to, paymentMethod, paymentBank }: ServiceLogTableProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>('15');

  const { data, isLoading } = useServiceLogs({
    dateFrom: from,
    dateTo: to,
    payment: paymentMethod ?? undefined,
    paymentBank: paymentBank ?? undefined,
    page,
    perPage,
  });

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const lastPage = data?.meta?.lastPage ?? 1;
  const currentPage = data?.meta?.currentPage ?? 1;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * (data?.meta?.perPage ?? 0) + 1;
  const rangeEnd = Math.min(rangeStart + logs.length - 1, total);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Registros del periodo"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 print:border-zinc-300 print:p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Registros del periodo
        </p>
        <p className="text-[12px] text-[var(--fg-muted)]">
          {total === 0 ? 'Sin registros' : `${total} ${total === 1 ? 'servicio' : 'servicios'}`}
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <ClipboardList className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--fg-strong)]">
            Sin registros en este rango
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--fg-secondary)]">
            Cambia el rango o los filtros para ver el detalle.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const pmCfg = log.paymentMethod ? PAYMENT_METHOD_CONFIG[log.paymentMethod] : null;
                  const isUnpaid = log.paymentStatus === 'unpaid';
                  const started = new Date(log.startedAt);

                  return (
                    <TableRow
                      key={log.id}
                      onClick={() => router.push(`/service-logs/${log.id}`)}
                      className="cursor-pointer print:cursor-auto"
                    >
                      <TableCell className="whitespace-nowrap text-[13px]">
                        {/* log_date, not started_at: the report groups by the
                            business day, and a service registered past midnight
                            would otherwise sit on a different date here than in
                            the breakdown above. */}
                        {format(parseISO(log.logDate), "d 'de' MMM", { locale: es })}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap tabular-nums text-[13px] text-[var(--fg-secondary)]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {format(started, 'HH:mm')}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-[13px] font-medium">
                        {log.clientResource?.label || log.clientResource?.plate || 'Sin recurso'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-[13px]">
                        {log.servicesSummary && log.servicesSummary.count > 1
                          ? `${log.servicesSummary.labels[0]} +${log.servicesSummary.count - 1}`
                          : (log.service?.name ?? '—')}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-[13px] text-[var(--fg-secondary)]">
                        {log.attendant?.name ?? '—'}
                      </TableCell>
                      <TableCell
                        className="text-right tabular-nums text-[13px] font-semibold"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {formatCurrency(log.priceCharged)}
                      </TableCell>
                      <TableCell>
                        {isUnpaid ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
                            <Wallet className="h-3 w-3" aria-hidden="true" />
                            Pendiente
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-[12.5px] text-[var(--fg-secondary)]">
                            {pmCfg?.label ?? '—'}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* The pager is for the screen; a printed report carries the rows the
              range holds, not a page of them. */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p className="text-[12px] text-[var(--fg-muted)]">
              Mostrando {rangeStart}–{rangeEnd} de {total}
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
                    onClick={() => setPage(currentPage - 1)}
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
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
              <Select
                value={perPage}
                onValueChange={(v) => {
                  setPerPage(v as PageSize);
                  setPage(1);
                }}
              >
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
        </>
      )}
    </section>
  );
}
