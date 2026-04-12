'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { getReservations } from '@/lib/api/reservations';
import { getServices } from '@/lib/api/services';
import { ReservationCard } from '@/components/reservations/ReservationCard';
import { ReservationForm } from '@/components/reservations/ReservationForm';
import { ReservationCalendar } from '@/components/reservations/ReservationCalendar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Reservation } from '@/types/reservation';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No asistió' },
];

export default function ReservationsPage() {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('all');
  const [serviceId, setServiceId] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
    };
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const queryParams = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    status: status !== 'all' ? status : undefined,
    service_id: serviceId !== 'all' ? serviceId : undefined,
  };

  const queryKey = ['reservations', queryParams];

  const { data } = useQuery({
    queryKey,
    queryFn: () => getReservations(queryParams),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 100 }),
  });

  const reservations = data?.data ?? [];
  const services = servicesData?.data ?? [];

  const handleDatesChange = useCallback((from: string, to: string) => {
    setDateRange({ from, to });
  }, []);

  const handleEventClick = useCallback((reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailDialogOpen(true);
  }, []);

  const handleDateSelect = useCallback((dateStr: string) => {
    setCreateDate(dateStr);
    setCreateDialogOpen(true);
  }, []);

  const handleCreated = () => {
    setCreateDialogOpen(false);
    setCreateDate(undefined);
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
  };

  const handleDetailClose = () => {
    setDetailDialogOpen(false);
    setSelectedReservation(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#343C6A]">Reservaciones</h1>
          <p className="text-[#718EBF]">Gestión de citas y reservaciones</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva reservación
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nueva reservación</DialogTitle>
            </DialogHeader>
            <ReservationForm
              defaultDate={createDate}
              onSuccess={handleCreated}
              onCancel={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[#343C6A]">Estado:</label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[#343C6A]">Servicio:</label>
          <Select value={serviceId} onValueChange={(v) => setServiceId(v ?? 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los servicios</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-[1.5625rem] p-4 shadow-sm">
        <ReservationCalendar
          reservations={reservations}
          onEventClick={handleEventClick}
          onDateSelect={handleDateSelect}
          onDatesChange={handleDatesChange}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => { if (!open) handleDetailClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de reservación</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <ReservationCard
              reservation={selectedReservation}
              queryKey={queryKey}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
