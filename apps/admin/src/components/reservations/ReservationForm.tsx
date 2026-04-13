'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getClientResources } from '@/lib/api/client-resources';
import { getServices } from '@/lib/api/services';
import { createReservation } from '@/lib/api/reservations';
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
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReservationForm({ defaultDate, onSuccess, onCancel }: ReservationFormProps) {
  const today = defaultDate || format(new Date(), 'yyyy-MM-dd');

  const [clientResourceId, setClientResourceId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [datetime, setDatetime] = useState(defaultDate ? `${defaultDate}T09:00` : `${today}T09:00`);
  const [notes, setNotes] = useState('');

  const { data: clientResourcesData } = useQuery({
    queryKey: ['client-resources', 'all'],
    queryFn: () => getClientResources({ per_page: 200 }),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 100 }),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createReservation,
    onSuccess: () => {
      toast.success('Reservación creada exitosamente');
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const message = (err as { message?: string })?.message ?? 'Error al crear la reservación';
      toast.error(message);
    },
  });

  const clientResources = clientResourcesData?.data ?? [];
  const services = servicesData?.data ?? [];

  const selectedResource = clientResources.find((r) => r.id === clientResourceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientResourceId || !serviceId || !datetime) {
      toast.error('Por favor completa todos los campos requeridos.');
      return;
    }

    if (!selectedResource?.client_id) {
      toast.error('El recurso seleccionado no tiene un cliente asociado.');
      return;
    }

    mutate({
      client_id: selectedResource.client_id,
      client_resource_id: clientResourceId,
      service_id: serviceId,
      scheduled_at: new Date(datetime).toISOString(),
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Client Resource */}
      <div className="space-y-1">
        <Label htmlFor="res-resource">Cliente</Label>
        <Select value={clientResourceId} onValueChange={(v) => setClientResourceId(v ?? '')}>
          <SelectTrigger id="res-resource" className="w-full">
            <SelectValue placeholder="Seleccionar cliente">
              {clientResourceId && selectedResource
                ? (() => {
                    const clientName = selectedResource.client?.name ?? '';
                    const plate = selectedResource.plate ?? '';
                    return clientName && plate
                      ? `${clientName} — ${plate}`
                      : clientName || plate || clientResourceId;
                  })()
                : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clientResources.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.client?.name ?? 'Sin nombre'}
                {r.plate ? ` — ${r.plate}` : ''}
                {r.brand ? ` (${r.brand}${r.model ? ` ${r.model}` : ''})` : ''}
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
          }}
        >
          <SelectTrigger id="res-service" className="w-full">
            <SelectValue placeholder="Seleccionar servicio">
              {serviceId
                ? (() => {
                    const s = services.find((s) => s.id === serviceId);
                    return s ? `${s.name} — $${Number(s.price).toFixed(2)}` : serviceId;
                  })()
                : undefined}
            </SelectValue>
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

      {/* Date & Time */}
      <div className="space-y-1">
        <Label htmlFor="res-datetime">Fecha y hora</Label>
        <Input
          id="res-datetime"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="w-full"
        />
      </div>

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

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending || !datetime}>
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
