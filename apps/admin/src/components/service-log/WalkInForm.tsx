'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createServiceLog } from '@/lib/api/service-log';
import type { ClientResource } from '@/types/client-resource';
import type { Service } from '@/types/service';
import type { User } from '@/types/user';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WalkInFormProps {
  clientResources: ClientResource[];
  services: Service[];
  users: User[];
}

export function WalkInForm({ clientResources, services, users }: WalkInFormProps) {
  const router = useRouter();

  const [clientResourceId, setClientResourceId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [attendedBy, setAttendedBy] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: createServiceLog,
    onSuccess: () => {
      router.push('/service-log');
    },
    onError: (err: unknown) => {
      const message = (err as { message?: string })?.message ?? 'Error al registrar el servicio';
      setError(message);
    },
  });

  // Auto-fill price when service is selected
  const handleServiceChange = (id: string | null) => {
    if (!id) return;
    setServiceId(id);
    const service = services.find((s) => s.id === id);
    if (service) {
      setPrice(service.price);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientResourceId || !serviceId || !attendedBy || !paymentMethod || !price) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    mutate({
      client_resource_id: clientResourceId,
      service_id: serviceId,
      attended_by: attendedBy,
      price_charged: Number(price),
      payment_method: paymentMethod,
      notes: notes || undefined,
    });
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Registrar servicio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle */}
          <div className="space-y-1">
            <Label htmlFor="vehicle">Vehículo (placa)</Label>
            <Select value={clientResourceId} onValueChange={(v) => setClientResourceId(v ?? '')}>
              <SelectTrigger id="vehicle" className="w-full">
                <SelectValue placeholder="Seleccionar vehículo" />
              </SelectTrigger>
              <SelectContent>
                {clientResources.map((v) => (
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
            <Label htmlFor="service">Servicio</Label>
            <Select value={serviceId} onValueChange={(v) => handleServiceChange(v)}>
              <SelectTrigger id="service" className="w-full">
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

          {/* Employee */}
          <div className="space-y-1">
            <Label htmlFor="employee">Empleado</Label>
            <Select value={attendedBy} onValueChange={(v) => setAttendedBy(v ?? '')}>
              <SelectTrigger id="employee" className="w-full">
                <SelectValue placeholder="Seleccionar empleado" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment method */}
          <div className="space-y-1">
            <Label htmlFor="payment">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? '')}>
              <SelectTrigger id="payment" className="w-full">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Registrando...' : 'Registrar servicio'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/service-log')}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
