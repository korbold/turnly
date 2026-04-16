'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, LayoutList, CalendarDays } from 'lucide-react';
import { useQueryState, parseAsString } from 'nuqs';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useReservations } from '@/presentation/hooks/use-reservations';
import { ReservationFilters, useFilterParams } from '@/presentation/components/features/reservations/filters';
import { Timeline } from '@/presentation/components/features/reservations/timeline';
import { DetailPanel } from '@/presentation/components/features/reservations/detail-panel';
import { CreateModal } from '@/presentation/components/features/reservations/create-modal';
import type { Reservation, ReservationStatus } from '@/domain/entities/reservation';

function ReservationsContent() {
  const { dateStr, statusFilter } = useFilterParams();
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Check URL for create=true
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const { data, isLoading } = useReservations({
    dateFrom: dateStr,
    dateTo: dateStr,
    status: statusFilter as ReservationStatus | undefined,
  });

  const reservations = data?.data ?? [];

  // For filter counts we need all reservations (unfiltered for that date)
  const { data: allData } = useReservations({
    dateFrom: dateStr,
    dateTo: dateStr,
  });
  const allReservations = allData?.data ?? [];

  // If status filter is set, display filtered, otherwise all
  const displayReservations = statusFilter
    ? reservations
    : allReservations;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Reservas</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border bg-white p-0.5">
            <button
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'timeline'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setView('timeline')}
            >
              <LayoutList className="mr-1 inline h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setView('calendar')}
            >
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              Calendario
            </button>
          </div>

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nueva Reserva
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ReservationFilters reservations={allReservations} />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : view === 'timeline' ? (
        <Timeline
          reservations={displayReservations}
          onSelect={setSelectedReservation}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-16 text-center">
          <CalendarDays className="mb-3 h-12 w-12 text-zinc-300" />
          <p className="text-sm text-muted-foreground">
            Vista de calendario proximamente
          </p>
        </div>
      )}

      {/* Detail panel */}
      <DetailPanel
        reservation={selectedReservation}
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

      {/* Create modal */}
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <ReservationsContent />
    </Suspense>
  );
}
