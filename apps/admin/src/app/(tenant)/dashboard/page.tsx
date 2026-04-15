'use client';

import { useQuery } from '@tanstack/react-query';
import { getDailyReport } from '@/lib/api/reports';
import { getReservations } from '@/lib/api/reservations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Car, DollarSign, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-100 text-slate-700',
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reservations?new=true">
            <Button
              size="sm"
              className="btn-gradient text-white rounded-lg"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nueva reservación
            </Button>
          </Link>
          <Link href="/service-log/new">
            <Button
              size="sm"
              className="btn-gradient text-white rounded-lg"
            >
              <Plus className="h-4 w-4 mr-1" />
              Registrar servicio
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="stat-cards-scroll">
        {/* Reservaciones hoy */}
        <div className="bg-white rounded-2xl shadow-card p-6 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 mb-4">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {report?.reservations.total ?? '—'}
          </div>
          <p className="text-sm text-slate-500 mt-1">Reservaciones hoy</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {report?.reservations.pending ?? 0} pendientes · {report?.reservations.confirmed ?? 0} confirmadas
          </p>
        </div>

        {/* Servicios realizados */}
        <div className="bg-white rounded-2xl shadow-card p-6 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 mb-4">
            <Car className="h-5 w-5 text-white" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {report?.washes.completed ?? '—'}
          </div>
          <p className="text-sm text-slate-500 mt-1">Servicios realizados</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {report?.washes.in_progress ?? 0} en progreso
          </p>
        </div>

        {/* Ingresos del día */}
        <div className="bg-white rounded-2xl shadow-card p-6 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 mb-4">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            ${report?.washes.revenue?.toFixed(2) ?? '—'}
          </div>
          <p className="text-sm text-slate-500 mt-1">Ingresos del día</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Efectivo: ${report?.washes.by_payment_method?.cash?.toFixed(2) ?? '0'}
          </p>
        </div>

        {/* Total servicios */}
        <div className="bg-white rounded-2xl shadow-card p-6 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 mb-4">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {report?.washes.total ?? '—'}
          </div>
          <p className="text-sm text-slate-500 mt-1">Total servicios</p>
          <p className="text-xs text-slate-500 mt-0.5">Hoy en total</p>
        </div>
      </div>

      {/* Upcoming reservations */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Próximas reservaciones</h2>
          <Link href="/reservations">
            <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50">
              Ver todas
            </Button>
          </Link>
        </div>
        <div className="p-6">
          {upcomingReservations?.data && upcomingReservations.data.length > 0 ? (
            <div className="space-y-3">
              {upcomingReservations.data.map((res) => (
                <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-indigo-50/30 transition-colors rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{res.client?.name ?? 'Cliente'}</p>
                      <p className="text-xs text-slate-500">
                        {res.client_resource?.plate} · {res.service?.name}
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
            <p className="text-slate-500 text-sm text-center py-4">No hay reservaciones próximas</p>
          )}
        </div>
      </div>
    </div>
  );
}
