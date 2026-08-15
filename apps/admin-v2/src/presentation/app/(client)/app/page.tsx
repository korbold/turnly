'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Compass } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useMe } from '@/presentation/hooks/use-auth';
import { useMyReservations } from '@/presentation/hooks/use-client-portal';
import { isUpcoming } from '@/domain/entities/client-reservation';
import { ClientReservationCard } from '@/presentation/components/features/client-portal/client-reservation-card';

export default function ClientHomePage() {
  const { data: me } = useMe();
  const { data: reservations, isLoading } = useMyReservations();

  const upcoming = (reservations ?? []).filter(isUpcoming);
  const firstName = (me?.user?.name ?? '').split(' ')[0];

  return (
    <div className="space-y-5">
      <header>
        <h1
          className="text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {firstName ? `Hola, ${firstName}` : 'Hola'}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--fg-secondary)]">
          {upcoming.length === 0
            ? 'No tienes reservas próximas.'
            : `Tienes ${upcoming.length} ${upcoming.length === 1 ? 'reserva próxima' : 'reservas próximas'}.`}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : upcoming.length > 0 ? (
        <>
          <div className="space-y-3">
            {upcoming.slice(0, 3).map((r) => (
              <ClientReservationCard key={r.id} reservation={r} />
            ))}
          </div>
          {upcoming.length > 3 && (
            <Link
              href="/app/reservas"
              className="flex items-center justify-center gap-1 text-[13.5px] font-semibold text-[var(--brand-700)]"
            >
              Ver todas <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-10 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <CalendarDays className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--fg-strong)]">Aún no reservas nada</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
            Busca un negocio y agenda tu próxima cita en un par de toques.
          </p>
          <Button asChild className="mt-5">
            <Link href="/explorar">
              <Compass className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Explorar negocios
            </Link>
          </Button>
        </div>
      )}

      {upcoming.length > 0 && (
        <Button asChild variant="outline" className="w-full">
          <Link href="/explorar">
            <Compass className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reservar en otro negocio
          </Link>
        </Button>
      )}

    </div>
  );
}
