'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
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

interface DailyTableProps {
  data?: DailyBreakdown[];
  isLoading: boolean;
  onRowClick?: (date: string) => void;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DailyTable({ data, isLoading, onRowClick }: DailyTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Desglose Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Desglose Diario</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
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
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Sin datos para este rango
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.date}
                    className={onRowClick ? 'cursor-pointer hover:bg-zinc-50' : ''}
                    onClick={() => onRowClick?.(row.date)}
                  >
                    <TableCell className="font-medium">
                      {format(parseISO(row.date), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell className="text-right">{row.services}</TableCell>
                    <TableCell className="text-right font-medium">{formatCOP(row.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCOP(row.byCash)}</TableCell>
                    <TableCell className="text-right">{formatCOP(row.byCard)}</TableCell>
                    <TableCell className="text-right">{formatCOP(row.byTransfer)}</TableCell>
                    <TableCell className="text-right">{row.reservations}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
