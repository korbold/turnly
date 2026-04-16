'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInMinutes } from 'date-fns';
import { Clock, CalendarCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useReservations } from '@/presentation/hooks/use-reservations';

export function UpcomingReservations() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading } = useReservations({
    dateFrom: today,
    dateTo: today,
    status: 'confirmed',
  });

  const upcoming = useMemo(() => {
    if (!data?.data) return [];
    const now = new Date();
    return data.data
      .filter((r) => new Date(r.scheduledAt) >= now)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
      .slice(0, 5);
  }, [data]);

  const router = useRouter();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Proximas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4 text-sky-500" />
          Proximas Reservas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CalendarCheck className="mb-2 h-10 w-10 text-zinc-300" />
            <p className="text-sm text-muted-foreground">
              Sin reservas pendientes hoy
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((res) => {
              const mins = differenceInMinutes(
                new Date(res.scheduledAt),
                new Date()
              );
              const soon = mins <= 30 && mins >= 0;

              return (
                <button
                  key={res.id}
                  className="flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition-shadow hover:shadow-sm"
                  onClick={() => router.push('/reservations')}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <Clock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {format(new Date(res.scheduledAt), 'HH:mm')}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {res.client?.name ?? 'Cliente'}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {res.service?.name ?? 'Servicio'}
                    </p>
                  </div>
                  {soon && (
                    <Badge className="shrink-0 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                      en {mins}min
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
