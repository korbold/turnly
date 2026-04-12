'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getVehicle, getVehicleHistory } from '@/lib/api/vehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: 'Sedán',
  suv: 'SUV',
  pickup: 'Pickup',
  van: 'Van',
  motorcycle: 'Moto',
  other: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => getVehicle(id),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['vehicle-history', id],
    queryFn: () => getVehicleHistory(id),
  });

  const washHistory = Array.isArray(history) ? history : [];

  if (vehicleLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Cargando vehículo...</div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12 text-muted-foreground">Vehículo no encontrado.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vehicles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{vehicle.plate}</h1>
          <p className="text-gray-500">
            {[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Vehicle Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información del vehículo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Placa</p>
              <p className="font-medium font-mono">{vehicle.plate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Marca</p>
              <p className="font-medium">{vehicle.brand ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Modelo</p>
              <p className="font-medium">{vehicle.model ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Color</p>
              <p className="font-medium">{vehicle.color ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tipo</p>
              <p className="font-medium">{VEHICLE_TYPE_LABELS[vehicle.type] ?? vehicle.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Propietario</p>
              <p className="font-medium">{vehicle.owner?.name ?? '—'}</p>
            </div>
            {vehicle.owner?.email && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Email propietario</p>
                <p className="font-medium">{vehicle.owner.email}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Registrado</p>
              <p className="font-medium">
                {format(new Date(vehicle.created_at), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wash History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de lavados</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando historial...</div>
          ) : washHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay lavados registrados para este vehículo.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Método de pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {washHistory.map((wash: Record<string, unknown>) => (
                  <TableRow key={String(wash.id)}>
                    <TableCell>
                      {wash.started_at
                        ? format(new Date(String(wash.started_at)), "d MMM yyyy HH:mm", { locale: es })
                        : wash.created_at
                        ? format(new Date(String(wash.created_at)), "d MMM yyyy HH:mm", { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {(wash.service as Record<string, unknown> | null)?.name
                        ? String((wash.service as Record<string, unknown>).name)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {wash.status ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[String(wash.status)] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {STATUS_LABELS[String(wash.status)] ?? String(wash.status)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {wash.price != null ? `$${parseFloat(String(wash.price)).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>{wash.payment_method ? String(wash.payment_method) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
