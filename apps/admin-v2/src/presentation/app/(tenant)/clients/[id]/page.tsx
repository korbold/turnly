'use client';

import { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Pencil, Car, User, CalendarDays, DollarSign, Hash } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { useClient, useClientHistory } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { ClientForm } from '@/presentation/components/features/clients/client-form';
import { cn } from '@/shared/utils/cn';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v);

function ClientDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading } = useClient(id);
  const { data: history } = useClientHistory(id);
  const { data: settings } = useSettings();

  const customFields = settings?.customFields ?? [];
  const historyItems = (history ?? []) as Array<{
    id: string;
    type: 'service' | 'reservation';
    date: string;
    serviceName?: string;
    amount?: number;
    status?: string;
  }>;

  const serviceHistory = historyItems.filter((h) => h.type === 'service');
  const reservationHistory = historyItems.filter((h) => h.type === 'reservation');

  // Stats from data field
  const clientData = (client?.data as Record<string, unknown> | null) ?? {};
  const totalVisits = (clientData.totalVisits as number) ?? serviceHistory.length;
  const totalSpent = (clientData.totalSpent as number) ?? 0;
  const lastVisit = (clientData.lastVisit as string) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Cliente no encontrado</p>
        <Button variant="link" onClick={() => router.push('/clients')}>
          Volver a clientes
        </Button>
      </div>
    );
  }

  const hasPlate = !!client.plate;

  return (
    <div className="space-y-4">
      {/* Back + Edit */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Clientes
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Client info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-muted)]">
              {hasPlate ? (
                <Car className="h-6 w-6 text-[var(--color-primary)]" />
              ) : (
                <User className="h-6 w-6 text-[var(--color-primary)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">
                {client.client?.name ?? 'Sin nombre'}
              </h2>
              {client.client?.email && (
                <p className="text-sm text-muted-foreground">{client.client.email}</p>
              )}
              {hasPlate && (
                <p className="mt-1 text-sm font-medium text-[var(--color-primary)]">{client.plate}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {client.brand && <Badge variant="secondary">{client.brand}</Badge>}
                {client.model && <Badge variant="secondary">{client.model}</Badge>}
                {client.color && <Badge variant="secondary">{client.color}</Badge>}
                {client.type && <Badge variant="secondary">{client.type}</Badge>}
              </div>

              {/* Custom fields display */}
              {customFields.length > 0 && client.data && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {customFields.map((cf) => {
                    const val = (client.data as Record<string, unknown>)?.[cf.key];
                    if (val == null || val === '') return null;
                    return (
                      <div key={cf.key}>
                        <span className="text-muted-foreground">{cf.label}: </span>
                        <span className="font-medium">{String(val)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-[var(--color-primary-muted)] p-2">
              <Hash className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total visitas</p>
              <p className="text-lg font-semibold">{totalVisits}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-50 p-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total gastado</p>
              <p className="text-lg font-semibold">{fmt(totalSpent)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-50 p-2">
              <CalendarDays className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ultima visita</p>
              <p className="text-sm font-semibold">
                {lastVisit
                  ? formatDistanceToNow(new Date(lastVisit), { addSuffix: true, locale: es })
                  : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History tabs */}
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">
            Servicios ({serviceHistory.length})
          </TabsTrigger>
          <TabsTrigger value="reservations">
            Reservas ({reservationHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-3">
          {serviceHistory.length === 0 ? (
            <div className="rounded-lg border bg-white py-12 text-center">
              <p className="text-sm text-muted-foreground">Sin servicios registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {serviceHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.serviceName ?? 'Servicio'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.date), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right">
                    {item.amount != null && (
                      <p className="text-sm font-semibold">{fmt(item.amount)}</p>
                    )}
                    {item.status && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px]',
                          item.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
                        )}
                      >
                        {item.status === 'completed' ? 'Completado' : 'En progreso'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservations" className="mt-3">
          {reservationHistory.length === 0 ? (
            <div className="rounded-lg border bg-white py-12 text-center">
              <p className="text-sm text-muted-foreground">Sin reservas registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reservationHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.serviceName ?? 'Reserva'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.date), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  {item.status && (
                    <Badge variant="secondary" className="text-[10px]">
                      {item.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit form */}
      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={client} />
    </div>
  );
}

export default function ClientDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      }
    >
      <ClientDetailContent />
    </Suspense>
  );
}
