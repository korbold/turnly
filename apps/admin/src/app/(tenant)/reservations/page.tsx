'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { getReservations } from '@/lib/api/reservations';
import { getServices } from '@/lib/api/services';
import { ReservationCard } from '@/components/reservations/ReservationCard';
import { ReservationForm } from '@/components/reservations/ReservationForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No asistió' },
];

const PER_PAGE = 20;

export default function ReservationsPage() {
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<string>('all');
  const [serviceId, setServiceId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryParams = {
    date: date || undefined,
    status: status !== 'all' ? status : undefined,
    service_id: serviceId !== 'all' ? serviceId : undefined,
    per_page: PER_PAGE,
    page,
  };

  const queryKey = ['reservations', queryParams];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getReservations(queryParams),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 100 }),
  });

  const reservations = data?.data ?? [];
  const services = servicesData?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const lastPage = data?.meta?.last_page ?? 1;

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservaciones</h1>
          <p className="text-gray-500">Gestión de citas y reservaciones</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva reservación
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nueva reservación</DialogTitle>
            </DialogHeader>
            <ReservationForm
              onSuccess={() => {
                setDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['reservations'] });
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Fecha:</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              handleFilterChange();
            }}
            className="w-44"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Estado:</label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v ?? 'all');
              handleFilterChange();
            }}
          >
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
          <label className="text-sm font-medium text-gray-700">Servicio:</label>
          <Select
            value={serviceId}
            onValueChange={(v) => {
              setServiceId(v ?? 'all');
              handleFilterChange();
            }}
          >
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

        {date && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDate('');
              handleFilterChange();
            }}
          >
            Limpiar fecha
          </Button>
        )}
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? 'Cargando...' : `${total} reservación${total !== 1 ? 'es' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando reservaciones...</div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay reservaciones para los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => (
                <ReservationCard key={r.id} reservation={r} queryKey={queryKey} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {page} de {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
