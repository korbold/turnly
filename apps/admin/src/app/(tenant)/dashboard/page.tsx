'use client';

import { useQuery } from '@tanstack/react-query';
import { getDailyReport } from '@/lib/api/reports';
import { getReservations } from '@/lib/api/reservations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Car, DollarSign, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: report } = useQuery({
    queryKey: ['daily-report', today],
    queryFn: () => getDailyReport(today),
  });

  const { data: upcomingReservations } = useQuery({
    queryKey: ['upcoming-reservations'],
    queryFn: () => getReservations({ status: 'confirmed', per_page: 3 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reservations?new=true">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nueva reservación
            </Button>
          </Link>
          <Link href="/wash-log/new">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Registrar lavado
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Reservaciones hoy</CardTitle>
            <CalendarDays className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report?.reservations.total ?? '—'}</div>
            <p className="text-xs text-gray-500 mt-1">
              {report?.reservations.pending ?? 0} pendientes · {report?.reservations.confirmed ?? 0} confirmadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Autos lavados</CardTitle>
            <Car className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report?.washes.completed ?? '—'}</div>
            <p className="text-xs text-gray-500 mt-1">
              {report?.washes.in_progress ?? 0} en progreso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ingresos del día</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${report?.washes.revenue?.toFixed(2) ?? '—'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Efectivo: ${report?.washes.by_payment_method?.cash?.toFixed(2) ?? '0'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total lavados</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report?.washes.total ?? '—'}</div>
            <p className="text-xs text-gray-500 mt-1">Hoy en total</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming reservations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Próximas reservaciones</CardTitle>
          <Link href="/reservations">
            <Button variant="ghost" size="sm">Ver todas</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {upcomingReservations?.data && upcomingReservations.data.length > 0 ? (
            <div className="space-y-3">
              {upcomingReservations.data.map((res) => (
                <div key={res.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{res.client?.name ?? 'Cliente'}</p>
                      <p className="text-xs text-gray-500">
                        {res.vehicle?.plate} · {res.service?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {format(new Date(res.scheduled_at), 'HH:mm')}
                    </p>
                    <Badge className={statusColors[res.status] ?? ''} variant="secondary">
                      {statusLabels[res.status] ?? res.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">No hay reservaciones próximas</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
