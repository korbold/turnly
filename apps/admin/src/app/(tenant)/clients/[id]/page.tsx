'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getClientResource, getClientResourceHistory } from '@/lib/api/client-resources';
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

export default function ClientResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: clientResource, isLoading: resourceLoading } = useQuery({
    queryKey: ['client-resource', id],
    queryFn: () => getClientResource(id),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['client-resource-history', id],
    queryFn: () => getClientResourceHistory(id),
  });

  const serviceHistory = Array.isArray(history) ? history : [];

  if (resourceLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Cargando vehículo...</div>
    );
  }

  if (!clientResource) {
    return (
      <div className="text-center py-12 text-muted-foreground">Vehículo no encontrado.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{clientResource.plate}</h1>
          <p className="text-gray-500">
            {[clientResource.brand, clientResource.model, clientResource.color].filter(Boolean).join(' · ')}
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
              <p className="font-medium font-mono">{clientResource.plate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Marca</p>
              <p className="font-medium">{clientResource.brand ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Modelo</p>
              <p className="font-medium">{clientResource.model ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Color</p>
              <p className="font-medium">{clientResource.color ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tipo</p>
              <p className="font-medium">{VEHICLE_TYPE_LABELS[clientResource.type ?? ''] ?? clientResource.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Registrado</p>
              <p className="font-medium">
                {format(new Date(clientResource.created_at), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wash History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando historial...</div>
          ) : serviceHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay servicios registrados para este vehículo.
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
                {serviceHistory.map((entry: Record<string, unknown>) => (
                  <TableRow key={String(entry.id)}>
                    <TableCell>
                      {entry.started_at
                        ? format(new Date(String(entry.started_at)), "d MMM yyyy HH:mm", { locale: es })
                        : entry.created_at
                        ? format(new Date(String(entry.created_at)), "d MMM yyyy HH:mm", { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {(entry.service as Record<string, unknown> | null)?.name
                        ? String((entry.service as Record<string, unknown>).name)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {entry.status ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[String(entry.status)] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {STATUS_LABELS[String(entry.status)] ?? String(entry.status)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.price != null ? `$${parseFloat(String(entry.price)).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>{entry.payment_method ? String(entry.payment_method) : '—'}</TableCell>
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
