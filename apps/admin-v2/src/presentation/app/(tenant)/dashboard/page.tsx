'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, ClipboardCheck, ArrowRight, CalendarDays } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { NewServiceModal } from '@/presentation/components/features/service-logs/new-service-modal';
import { DailySummary } from '@/presentation/components/features/service-logs/daily-summary';
import { LogList } from '@/presentation/components/features/service-logs/log-list';
import { useMe } from '@/presentation/hooks/use-auth';
import { useReservations } from '@/presentation/hooks/use-reservations';
import { useServices } from '@/presentation/hooks/use-services';
import type {
  Reservation,
  ReservationStatus,
} from '@/domain/entities/reservation';
import { NextUp } from '@/presentation/components/features/dashboard/next-up';
import { DayStats } from '@/presentation/components/features/dashboard/day-stats';
import { DashboardEmpty } from '@/presentation/components/features/dashboard/dashboard-empty';
import { OfflineBanner } from '@/presentation/components/features/dashboard/offline-banner';
import { ReservationDetailSheet } from '@/presentation/components/features/dashboard/reservation-detail-sheet';
import { useNow, useIsOnline } from '@/presentation/components/features/dashboard/use-now';

function getGreeting(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * The two things the counter does all day: book, and watch the day go by.
 *
 * The daily log leads because that is where the work actually is — a car wash
 * runs on walk-ins, and a dashboard built only around appointments announces an
 * empty day while twenty cars are being washed. Reservations keep a column of
 * their own so the booking side stays one click away rather than disappearing.
 */
export default function DashboardPage() {
  const router = useRouter();
  const now = useNow(30_000);
  const isOnline = useIsOnline();

  const { data: me } = useMe();
  const firstName = me?.user?.name?.split(' ')[0] ?? '';
  const greeting = getGreeting(now.getHours());

  const today = format(now, 'yyyy-MM-dd');
  const reservationsQuery = useReservations(
    { dateFrom: today, dateTo: today },
    isOnline
  );
  const servicesQuery = useServices();

  const reservations = useMemo<Reservation[]>(
    () => reservationsQuery.data?.data ?? [],
    [reservationsQuery.data]
  );

  const hasServices = useMemo(() => {
    const services = servicesQuery.data?.data ?? [];
    return services.length > 0;
  }, [servicesQuery.data]);

  const [filter, setFilter] = useState<ReservationStatus | null>(null);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [logServiceOpen, setLogServiceOpen] = useState(false);

  const lastUpdated = reservationsQuery.dataUpdatedAt
    ? new Date(reservationsQuery.dataUpdatedAt)
    : null;

  function openDetail(reservation: Reservation) {
    setSelected(reservation);
    setDetailOpen(true);
  }

  function goToWalkIn() {
    router.push('/reservations?create=true');
  }

  // Nothing to sell yet: services come before any of this is meaningful.
  const showFirstRun = !servicesQuery.isLoading && !hasServices;
  const hasReservations = reservations.length > 0;

  if (showFirstRun) {
    return (
      <div className="space-y-5">
        <OfflineBanner isOnline={isOnline} lastUpdated={lastUpdated} />
        <div className="mx-auto w-full max-w-xl">
          <DashboardEmpty variant="no-services" onCreateWalkIn={goToWalkIn} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <OfflineBanner isOnline={isOnline} lastUpdated={lastUpdated} />

      {/* Both entry points, always — they used to vanish on a day with no
          appointments, which is precisely the day you need them. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1
            className="truncate text-[19px] font-semibold text-[var(--fg-strong)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--fg-secondary)]">
            Esto es lo que va del día.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={goToWalkIn}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Nueva reserva
          </Button>
          <Button size="sm" onClick={() => setLogServiceOpen(true)}>
            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Registrar servicio
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-6">
        <section aria-label="Registro del día" className="min-w-0 space-y-3">
          <DailySummary date={today} />

          <div className="flex items-center justify-between gap-2">
            <h2
              className="text-[17px] font-semibold text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Servicios de hoy
            </h2>
            <Link
              href="/service-logs"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--brand-600)] hover:underline"
            >
              Ver todo
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <LogList
            date={today}
            perPage="10"
            compact
            onCreate={() => setLogServiceOpen(true)}
          />
        </section>

        <aside
          aria-label="Citas de hoy"
          className="space-y-4 lg:sticky lg:top-4 lg:self-start"
        >
          {hasReservations ? (
            <NextUp
              reservations={reservations}
              now={now}
              isLoading={reservationsQuery.isLoading}
              greeting={greeting}
              firstName={firstName}
              onOpenDetail={openDetail}
            />
          ) : (
            // Deliberately small: an empty agenda shouldn't take half the screen
            // to say nothing, which is what the full empty card used to do.
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-sunken)]">
                  <CalendarDays className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
                </span>
                <p className="text-[13.5px] font-medium text-[var(--fg-strong)]">
                  Sin citas para hoy
                </p>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--fg-secondary)]">
                Las visitas sin cita también cuentan: quedan en el registro de la
                izquierda.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={goToWalkIn}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Nueva reserva
              </Button>
            </div>
          )}

          <DayStats
            reservations={reservations}
            isLoading={reservationsQuery.isLoading}
            activeFilter={filter}
            onFilterChange={setFilter}
          />

          <Link
            href="/reservations"
            className="inline-flex items-center gap-1 px-1 text-[13px] font-medium text-[var(--brand-600)] hover:underline"
          >
            Ver la agenda completa
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <ReservationDetailSheet
        reservation={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <NewServiceModal open={logServiceOpen} onClose={() => setLogServiceOpen(false)} />
    </div>
  );
}
