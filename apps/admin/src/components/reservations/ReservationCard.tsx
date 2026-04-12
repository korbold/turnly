'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  confirmReservation,
  startReservation,
  completeReservation,
  cancelReservation,
} from '@/lib/api/reservations';
import type { Reservation, ReservationStatus } from '@/types/reservation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const statusLabels: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

const statusClasses: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  no_show: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface ReservationCardProps {
  reservation: Reservation;
  queryKey?: unknown[];
}

export function ReservationCard({ reservation, queryKey }: ReservationCardProps) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKey ?? ['reservations'] });
  };

  const { mutate: confirm, isPending: confirming } = useMutation({
    mutationFn: () => confirmReservation(reservation.id),
    onSuccess: invalidate,
  });

  const { mutate: start, isPending: starting } = useMutation({
    mutationFn: () => startReservation(reservation.id),
    onSuccess: invalidate,
  });

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: () => completeReservation(reservation.id),
    onSuccess: invalidate,
  });

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: () => cancelReservation(reservation.id),
    onSuccess: invalidate,
  });

  const isLoading = confirming || starting || completing || cancelling;

  const time = format(new Date(reservation.scheduled_at), 'HH:mm');
  const clientName = reservation.client?.name ?? '—';
  const plate = reservation.client_resource?.plate ?? '—';
  const resourceLabel = reservation.client_resource
    ? `${plate}${reservation.client_resource.brand ? ` · ${reservation.client_resource.brand}${reservation.client_resource.model ? ` ${reservation.client_resource.model}` : ''}` : ''}`
    : plate;
  const serviceName = reservation.service?.name ?? '—';

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: main info */}
          <div className="flex gap-4 items-start">
            <div className="text-2xl font-bold text-gray-900 tabular-nums w-14 shrink-0">
              {time}
            </div>
            <div className="space-y-0.5">
              <p className="font-medium text-gray-900">{clientName}</p>
              <p className="text-sm text-gray-500 font-mono">{resourceLabel}</p>
              <p className="text-sm text-gray-600">{serviceName}</p>
            </div>
          </div>

          {/* Right: status + actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses[reservation.status]}`}
            >
              {statusLabels[reservation.status]}
            </span>

            <div className="flex gap-1.5 flex-wrap justify-end">
              {reservation.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => confirm()}
                  >
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => cancel()}
                    className="text-destructive hover:text-destructive"
                  >
                    Cancelar
                  </Button>
                </>
              )}

              {reservation.status === 'confirmed' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => start()}
                  >
                    Iniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => cancel()}
                    className="text-destructive hover:text-destructive"
                  >
                    Cancelar
                  </Button>
                </>
              )}

              {reservation.status === 'in_progress' && (
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => complete()}
                >
                  Completar
                </Button>
              )}
            </div>
          </div>
        </div>

        {reservation.notes && (
          <p className="mt-2 text-xs text-gray-400 border-t pt-2">{reservation.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
