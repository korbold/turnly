'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, LayoutList, CalendarDays } from 'lucide-react';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useReservations } from '@/presentation/hooks/use-reservations';
import {
  ReservationFilters,
  useFilterParams,
} from '@/presentation/components/features/reservations/filters';
import { Timeline } from '@/presentation/components/features/reservations/timeline';
import { CalendarView } from '@/presentation/components/features/reservations/calendar-view';
import { DetailPanel } from '@/presentation/components/features/reservations/detail-panel';
import { CreateModal } from '@/presentation/components/features/reservations/create-modal';
import type { Reservation, ReservationStatus } from '@/domain/entities/reservation';

function ReservationsContent() {
  const { dateStr, setDateStr, statusFilter } = useFilterParams();
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const reservationRepo = useRepository('reservation');

  // Check URL for create=true or reservation={id}
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Track which reservation we already opened from the URL so we don't
  // refetch + reopen the panel every time *any* other URL param (date,
  // status, view) changes. Without this guard the panel re-appears on
  // every filter tweak because useSearchParams returns a new object.
  const lastOpenedFromUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateOpen(true);
    }
    const reservationId = searchParams.get('reservation');
    if (reservationId && reservationId !== lastOpenedFromUrlRef.current) {
      lastOpenedFromUrlRef.current = reservationId;
      reservationRepo.getById(reservationId).then(setSelectedReservation).catch(() => {});
    } else if (!reservationId) {
      lastOpenedFromUrlRef.current = null;
    }
  }, [searchParams, reservationRepo]);

  function closeDetailPanel() {
    setSelectedReservation(null);
    lastOpenedFromUrlRef.current = null;
    if (searchParams.has('reservation')) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('reservation');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }

  // Calendar month date range (full visible grid)
  const calendarRange = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return {
      from: format(gridStart, 'yyyy-MM-dd'),
      to: format(gridEnd, 'yyyy-MM-dd'),
    };
  }, [calendarMonth]);

  // Data for timeline view (single day)
  const { data: timelineData, isLoading: timelineLoading } = useReservations({
    dateFrom: dateStr,
    dateTo: dateStr,
    status: statusFilter as ReservationStatus | undefined,
  });

  // Unfiltered for status counts (timeline)
  const { data: allTimelineData } = useReservations({
    dateFrom: dateStr,
    dateTo: dateStr,
  });

  // Data for calendar view (full month range)
  const { data: calendarData, isLoading: calendarLoading } = useReservations(
    {
      dateFrom: calendarRange.from,
      dateTo: calendarRange.to,
      status: statusFilter as ReservationStatus | undefined,
    },
    view === 'calendar'
  );

  // Unfiltered for status counts (calendar)
  const { data: allCalendarData } = useReservations(
    { dateFrom: calendarRange.from, dateTo: calendarRange.to },
    view === 'calendar'
  );

  const isLoading = view === 'timeline' ? timelineLoading : calendarLoading;

  const allReservations = view === 'timeline'
    ? (allTimelineData?.data ?? [])
    : (allCalendarData?.data ?? []);

  const displayReservations = view === 'timeline'
    ? (statusFilter ? (timelineData?.data ?? []) : allReservations)
    : (statusFilter ? (calendarData?.data ?? []) : allReservations);

  function handleCalendarSelectDay(date: Date) {
    setDateStr(format(date, 'yyyy-MM-dd'));
    setView('timeline');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border bg-white p-0.5">
            <button
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'timeline'
                  ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary-hover)]'
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
                  ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary-hover)]'
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
      {view === 'timeline' ? (
        <ReservationFilters reservations={allReservations} />
      ) : (
        <ReservationFilters
          reservations={allReservations}
          calendarMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
        />
      )}

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
        <CalendarView
          month={calendarMonth}
          reservations={displayReservations}
          onSelectDay={handleCalendarSelectDay}
          onSelectReservation={setSelectedReservation}
        />
      )}

      {/* Detail panel */}
      <DetailPanel
        reservation={selectedReservation}
        open={!!selectedReservation}
        onClose={closeDetailPanel}
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
