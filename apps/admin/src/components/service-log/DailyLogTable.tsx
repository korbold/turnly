'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { completeServiceLog, deleteServiceLog } from '@/lib/api/service-log';
import type { ServiceLog } from '@/types/service-log';
import type { Reservation } from '@/types/reservation';
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
import { Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const serviceStatusLabels: Record<string, string> = {
  in_progress: 'En progreso',
  completed: 'Completado',
};

const serviceStatusVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  in_progress: 'secondary',
  completed: 'default',
};

const reservationStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

const reservationStatusClasses: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  no_show: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface DailyLogTableProps {
  logs: ServiceLog[];
  reservations?: Reservation[];
  date: string;
  onEdit?: (log: ServiceLog) => void;
}

export function DailyLogTable({ logs, reservations = [], date, onEdit }: DailyLogTableProps) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLog, setDeletingLog] = useState<ServiceLog | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['service-logs', date] });
    queryClient.invalidateQueries({ queryKey: ['daily-summary', date] });
  };

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: completeServiceLog,
    onSuccess: () => { toast.success('Servicio completado'); invalidate(); },
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: deleteServiceLog,
    onSuccess: () => {
      toast.success('Registro eliminado');
      setDeleteDialogOpen(false);
      setDeletingLog(null);
      invalidate();
    },
  });

  const handleDeleteClick = (log: ServiceLog) => {
    setDeletingLog(log);
    setDeleteDialogOpen(true);
  };

  const hasData = logs.length > 0 || reservations.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No hay registros para este día.
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {/* Reservation cards */}
        {reservations.map((r) => (
          <div key={`res-mob-${r.id}`} className="rounded-xl border bg-blue-50/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.client?.name ?? '—'}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${reservationStatusClasses[r.status] ?? ''}`}>
                {reservationStatusLabels[r.status] ?? r.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>{format(new Date(r.scheduled_at), 'HH:mm')} — {r.service?.name ?? '—'}</p>
              <p>{r.service?.price ? `$${Number(r.service.price).toFixed(2)}` : '—'}</p>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">Reservación</Badge>
          </div>
        ))}
        {/* Service log cards */}
        {logs.map((log) => (
          <div key={`log-mob-${log.id}`} className="rounded-xl border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{log.client_resource?.plate ?? '—'}</span>
              <Badge variant={serviceStatusVariants[log.status] ?? 'outline'}>
                {serviceStatusLabels[log.status] ?? log.status}
              </Badge>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>{format(new Date(log.started_at), 'HH:mm')} — {log.service?.name ?? '—'}</p>
              <p>{log.attendant?.name ?? '—'} — ${Number(log.price_charged).toFixed(2)}</p>
              <p>{paymentLabels[log.payment_method] ?? log.payment_method}</p>
            </div>
            <div className="flex gap-1 pt-1">
              {log.status === 'in_progress' && (
                <Button size="sm" variant="outline" disabled={completing} onClick={() => complete(log.id)}>
                  Completar
                </Button>
              )}
              {onEdit && (
                <Button size="icon" variant="ghost" onClick={() => onEdit(log)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(log)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Reservations */}
          {reservations.map((r) => (
            <TableRow key={`res-${r.id}`} className="bg-blue-50/30">
              <TableCell>
                {format(new Date(r.scheduled_at), 'HH:mm')}
              </TableCell>
              <TableCell className="font-medium">
                {r.client?.name ?? '—'}
              </TableCell>
              <TableCell>{r.service?.name ?? '—'}</TableCell>
              <TableCell>—</TableCell>
              <TableCell>{r.service?.price ? `$${Number(r.service.price).toFixed(2)}` : '—'}</TableCell>
              <TableCell>—</TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${reservationStatusClasses[r.status] ?? ''}`}>
                  {reservationStatusLabels[r.status] ?? r.status}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-blue-600 border-blue-200">Reservación</Badge>
              </TableCell>
              <TableCell />
            </TableRow>
          ))}

          {/* Service logs */}
          {logs.map((log) => (
            <TableRow key={`log-${log.id}`}>
              <TableCell>
                {format(new Date(log.started_at), 'HH:mm')}
              </TableCell>
              <TableCell className="font-medium">
                {log.client_resource?.plate ?? '—'}
              </TableCell>
              <TableCell>{log.service?.name ?? '—'}</TableCell>
              <TableCell>{log.attendant?.name ?? '—'}</TableCell>
              <TableCell>${Number(log.price_charged).toFixed(2)}</TableCell>
              <TableCell>{paymentLabels[log.payment_method] ?? log.payment_method}</TableCell>
              <TableCell>
                <Badge variant={serviceStatusVariants[log.status] ?? 'outline'}>
                  {serviceStatusLabels[log.status] ?? log.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">Servicio</Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {log.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={completing}
                      onClick={() => complete(log.id)}
                    >
                      Completar
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(log)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(log)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar registro</DialogTitle>
          </DialogHeader>
          {deletingLog && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                ¿Estás seguro de que deseas eliminar este registro?
              </p>
              <div className="rounded-md border p-3 text-sm space-y-1 bg-gray-50">
                <p><strong>Cliente:</strong> {deletingLog.client_resource?.plate ?? '—'}</p>
                <p><strong>Servicio:</strong> {deletingLog.service?.name ?? '—'}</p>
                <p><strong>Empleado:</strong> {deletingLog.attendant?.name ?? '—'}</p>
                <p><strong>Precio:</strong> ${Number(deletingLog.price_charged).toFixed(2)}</p>
                <p><strong>Hora:</strong> {format(new Date(deletingLog.started_at), 'HH:mm')}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deletingLog && remove(deletingLog.id)}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
