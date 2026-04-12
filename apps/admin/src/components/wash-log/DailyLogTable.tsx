'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeWashLog } from '@/lib/api/wash-log';
import type { WashLog } from '@/types/wash-log';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const statusLabels: Record<string, string> = {
  in_progress: 'En progreso',
  completed: 'Completado',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  in_progress: 'secondary',
  completed: 'default',
};

interface DailyLogTableProps {
  logs: WashLog[];
  date: string;
}

export function DailyLogTable({ logs, date }: DailyLogTableProps) {
  const queryClient = useQueryClient();

  const { mutate: complete, isPending } = useMutation({
    mutationFn: completeWashLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wash-logs', date] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary', date] });
    },
  });

  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No hay lavados registrados para este día.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hora</TableHead>
          <TableHead>Placa</TableHead>
          <TableHead>Servicio</TableHead>
          <TableHead>Empleado</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Pago</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              {format(new Date(log.started_at), 'HH:mm')}
            </TableCell>
            <TableCell className="font-mono font-medium">
              {log.vehicle?.plate ?? '—'}
            </TableCell>
            <TableCell>{log.service?.name ?? '—'}</TableCell>
            <TableCell>{log.attendant?.name ?? '—'}</TableCell>
            <TableCell>${Number(log.price_charged).toFixed(2)}</TableCell>
            <TableCell>{paymentLabels[log.payment_method] ?? log.payment_method}</TableCell>
            <TableCell>
              <Badge variant={statusVariants[log.status] ?? 'outline'}>
                {statusLabels[log.status] ?? log.status}
              </Badge>
            </TableCell>
            <TableCell>
              {log.status === 'in_progress' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => complete(log.id)}
                >
                  Completar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
