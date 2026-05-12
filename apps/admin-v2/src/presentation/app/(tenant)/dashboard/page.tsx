'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, ClipboardCheck } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { NewServiceModal } from '@/presentation/components/features/service-logs/new-service-modal';
import { useMe } from '@/presentation/hooks/use-auth';
import { useReservations } from '@/presentation/hooks/use-reservations';
import { useServices } from '@/presentation/hooks/use-services';
import type {
  Reservation,
  ReservationStatus,
} from '@/domain/entities/reservation';
import { NextUp } from '@/presentation/components/features/dashboard/next-up';
import { DayStats } from '@/presentation/components/features/dashboard/day-stats';
import { DayTimeline } from '@/presentation/components/features/dashboard/day-timeline';
import { DashboardEmpty } from '@/presentation/components/features/dashboard/dashboard-empty';
import { OfflineBanner } from '@/presentation/components/features/dashboard/offline-banner';
import { ReservationDetailSheet } from '@/presentation/components/features/dashboard/reservation-detail-sheet';
import { useNow, useIsOnline } from '@/presentation/components/features/dashboard/use-now';

function getGreeting(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

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

  const showFirstRun =
    !servicesQuery.isLoading && !hasServices && reservations.length === 0;
  const showEmptyToday =
    !reservationsQuery.isLoading &&
    hasServices &&
    reservations.length === 0;

  return (
    <div className="space-y-5 lg:space-y-6">
      <OfflineBanner isOnline={isOnline} lastUpdated={lastUpdated} />

      <div
        className={
          showFirstRun || showEmptyToday
            ? 'mx-auto w-full max-w-xl'
            : 'grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-6'
        }
      >
        <aside
          className={
            showFirstRun || showEmptyToday
              ? 'space-y-4'
              : 'space-y-4 lg:sticky lg:top-4 lg:self-start'
          }
        >
          {showFirstRun ? (
            <DashboardEmpty
              variant="no-services"
              onCreateWalkIn={goToWalkIn}
            />
          ) : showEmptyToday ? (
            <DashboardEmpty
              variant="no-reservations"
              onCreateWalkIn={goToWalkIn}
            />
          ) : (
            <NextUp
              reservations={reservations}
              now={now}
              isLoading={reservationsQuery.isLoading}
              greeting={greeting}
              firstName={firstName}
              onOpenDetail={openDetail}
            />
          )}

          {!showFirstRun && (
            <DayStats
              reservations={reservations}
              isLoading={reservationsQuery.isLoading}
              activeFilter={filter}
              onFilterChange={setFilter}
            />
          )}
        </aside>

        {!showFirstRun && !showEmptyToday && (
          <section
            aria-label="Agenda del día"
            className="space-y-3"
          >
            <header className="flex items-center justify-between gap-2">
              <h2
                className="text-[17px] font-semibold text-[var(--fg-strong)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Agenda del día
              </h2>
              <div className="hidden items-center gap-2 sm:flex">
                <Button size="sm" variant="outline" onClick={goToWalkIn}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Nueva reserva
                </Button>
                <Button size="sm" onClick={() => setLogServiceOpen(true)}>
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Registrar servicio
                </Button>
              </div>
            </header>

            <DayTimeline
              reservations={reservations}
              isLoading={reservationsQuery.isLoading}
              now={now}
              filter={filter}
              onSelect={openDetail}
              onCreateAt={() => goToWalkIn()}
            />
          </section>
        )}
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
