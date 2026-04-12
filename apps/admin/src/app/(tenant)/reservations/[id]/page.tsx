'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getReservation,
  confirmReservation,
  startReservation,
  completeReservation,
  cancelReservation,
} from '@/lib/api/reservations';
import type { ReservationStatus } from '@/types/reservation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReservationDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const queryKey = ['reservation', id];

  const { data: reservation, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getReservation(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
  };

  const { mutate: confirm, isPending: confirming } = useMutation({
    mutationFn: () => confirmReservation(id),
    onSuccess: invalidate,
  });

  const { mutate: start, isPending: starting } = useMutation({
    mutationFn: () => startReservation(id),
    onSuccess: invalidate,
  });

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: () => completeReservation(id),
    onSuccess: invalidate,
  });

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: () => cancelReservation(id),
    onSuccess: invalidate,
  });

  const isActionPending = confirming || starting || completing || cancelling;

  if (isLoading) {
    return (
      <div className="text-center py-16 text-muted-foreground">Cargando reservación...</div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="space-y-4">
        <Link href="/reservations">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
        <p className="text-destructive">No se pudo cargar la reservación.</p>
      </div>
    );
  }

  const scheduledDate = new Date(reservation.scheduled_at);
  const formattedDateTime = format(scheduledDate, "EEEE d 'de' MMMM yyyy 'a las' HH:mm", {
    locale: es,
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <Link href="/reservations">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a reservaciones
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de reservación</h1>
          <p className="text-gray-500 capitalize">{formattedDateTime}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusClasses[reservation.status]}`}
        >
          {statusLabels[reservation.status]}
        </span>
      </div>

      {/* Client */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Nombre: </span>
            <span className="font-medium">{reservation.client?.name ?? '—'}</span>
          </p>
          <p>
            <span className="text-gray-500">Email: </span>
            <span>{reservation.client?.email ?? '—'}</span>
          </p>
        </CardContent>
      </Card>

      {/* Vehicle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Placa: </span>
            <span className="font-mono font-medium">{reservation.vehicle?.plate ?? '—'}</span>
          </p>
          {reservation.vehicle?.brand && (
            <p>
              <span className="text-gray-500">Marca/Modelo: </span>
              <span>
                {reservation.vehicle.brand}
                {reservation.vehicle.model ? ` ${reservation.vehicle.model}` : ''}
              </span>
            </p>
          )}
          {reservation.vehicle?.color && (
            <p>
              <span className="text-gray-500">Color: </span>
              <span>{reservation.vehicle.color}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Service */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servicio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Nombre: </span>
            <span className="font-medium">{reservation.service?.name ?? '—'}</span>
          </p>
          {reservation.service?.price && (
            <p>
              <span className="text-gray-500">Precio: </span>
              <span>${Number(reservation.service.price).toFixed(2)}</span>
            </p>
          )}
          {reservation.service?.duration_minutes && (
            <p>
              <span className="text-gray-500">Duración: </span>
              <span>{reservation.service.duration_minutes} minutos</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {reservation.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{reservation.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Cancellation */}
      {reservation.status === 'cancelled' && (reservation.cancelled_at || reservation.cancel_reason) && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-700">Información de cancelación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {reservation.cancelled_at && (
              <p>
                <span className="text-gray-500">Cancelada el: </span>
                <span>{format(new Date(reservation.cancelled_at), 'dd/MM/yyyy HH:mm')}</span>
              </p>
            )}
            {reservation.cancel_reason && (
              <p>
                <span className="text-gray-500">Motivo: </span>
                <span>{reservation.cancel_reason}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {(reservation.status === 'pending' ||
        reservation.status === 'confirmed' ||
        reservation.status === 'in_progress') && (
        <div className="flex gap-3">
          {reservation.status === 'pending' && (
            <>
              <Button disabled={isActionPending} onClick={() => confirm()}>
                Confirmar
              </Button>
              <Button
                variant="outline"
                disabled={isActionPending}
                onClick={() => cancel()}
                className="text-destructive hover:text-destructive"
              >
                Cancelar
              </Button>
            </>
          )}

          {reservation.status === 'confirmed' && (
            <>
              <Button disabled={isActionPending} onClick={() => start()}>
                Iniciar
              </Button>
              <Button
                variant="outline"
                disabled={isActionPending}
                onClick={() => cancel()}
                className="text-destructive hover:text-destructive"
              >
                Cancelar
              </Button>
            </>
          )}

          {reservation.status === 'in_progress' && (
            <Button disabled={isActionPending} onClick={() => complete()}>
              Completar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
