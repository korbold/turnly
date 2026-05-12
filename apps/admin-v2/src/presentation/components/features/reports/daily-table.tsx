'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TableProperties } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/presentation/components/ui/table';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import type { DailyBreakdown } from '@/domain/repositories/report.repository';
import { formatCurrency } from '@/shared/utils/format';

interface DailyTableProps {
  data?: DailyBreakdown[];
  isLoading: boolean;
  onRowClick?: (date: string) => void;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Desglose diario"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        Desglose diario
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const cellMonoClass =
  'text-right font-semibold tabular-nums text-[var(--fg-strong)]';

export function DailyTable({ data, isLoading, onRowClick }: DailyTableProps) {
  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Shell>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <TableProperties className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--fg-strong)]">
            Sin datos para este rango
          </p>
          <p className="mt-1 max-w-xs text-[12.5px] text-[var(--fg-secondary)]">
            Cambia el filtro o registra servicios para ver el desglose.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Servicios</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Efectivo</TableHead>
              <TableHead className="text-right">Tarjeta</TableHead>
              <TableHead className="text-right">Transfer.</TableHead>
              <TableHead className="text-right">Reservas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.date}
                className={
                  onRowClick
                    ? 'cursor-pointer transition-colors hover:bg-[var(--bg-hover)]'
                    : ''
                }
                onClick={() => onRowClick?.(row.date)}
              >
                <TableCell className="font-medium">
                  {format(parseISO(row.date), "d 'de' MMM yyyy", { locale: es })}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.services}</TableCell>
                <TableCell
                  className={cellMonoClass}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(row.revenue)}
                </TableCell>
                <TableCell
                  className="text-right tabular-nums text-[var(--fg-secondary)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(row.byCash)}
                </TableCell>
                <TableCell
                  className="text-right tabular-nums text-[var(--fg-secondary)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(row.byCard)}
                </TableCell>
                <TableCell
                  className="text-right tabular-nums text-[var(--fg-secondary)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(row.byTransfer)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.reservations}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Shell>
  );
}
