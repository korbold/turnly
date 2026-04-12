'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getVehicles } from '@/lib/api/vehicles';
import { getServices } from '@/lib/api/services';
import { createReservation, getAvailableSlots } from '@/lib/api/reservations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReservationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReservationForm({ onSuccess, onCancel }: ReservationFormProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [vehicleId, setVehicleId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: () => getVehicles({ per_page: 200 }),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 100 }),
  });

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['available-slots', date, serviceId],
    queryFn: () => getAvailableSlots(date, serviceId),
    enabled: !!date && !!serviceId,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createReservation,
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const message = (err as { message?: string })?.message ?? 'Error al crear la reservación';
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vehicleId || !serviceId || !date || !selectedSlot) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    mutate({
      vehicle_id: vehicleId,
      service_id: serviceId,
      scheduled_at: selectedSlot,
      notes: notes || undefined,
    });
  };

  const vehicles = vehiclesData?.data ?? [];
  const services = servicesData?.data ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Vehicle */}
      <div className="space-y-1">
        <Label htmlFor="res-vehicle">Vehículo (placa)</Label>
        <Select value={vehicleId} onValueChange={(v) => setVehicleId(v ?? '')}>
          <SelectTrigger id="res-vehicle" className="w-full">
            <SelectValue placeholder="Seleccionar vehículo" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.plate}
                {v.brand ? ` — ${v.brand}${v.model ? ` ${v.model}` : ''}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Service */}
      <div className="space-y-1">
        <Label htmlFor="res-service">Servicio</Label>
        <Select
          value={serviceId}
          onValueChange={(v) => {
            setServiceId(v ?? '');
            setSelectedSlot(null);
          }}
        >
          <SelectTrigger id="res-service" className="w-full">
            <SelectValue placeholder="Seleccionar servicio" />
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} — ${Number(s.price).toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="res-date">Fecha</Label>
        <Input
          id="res-date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot(null);
          }}
          className="w-full"
        />
      </div>

      {/* Available slots */}
      {serviceId && date && (
        <div className="space-y-2">
          <Label>Horario disponible</Label>
          {slotsLoading ? (
            <p className="text-sm text-muted-foreground">Cargando horarios...</p>
          ) : slots && slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => {
                const timeLabel = format(new Date(slot.start), 'HH:mm');
                const isSelected = selectedSlot === slot.start;
                return (
                  <Button
                    key={slot.start}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className={isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                    onClick={() => setSelectedSlot(slot.start)}
                  >
                    {timeLabel}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay horarios disponibles para esta fecha y servicio.
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="res-notes">Notas (opcional)</Label>
        <Textarea
          id="res-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones adicionales..."
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending || !selectedSlot}>
          {isPending ? 'Creando...' : 'Crear reservación'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
