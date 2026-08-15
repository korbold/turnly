'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Compass } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { useMyReservations } from '@/presentation/hooks/use-client-portal';
import { isUpcoming } from '@/domain/entities/client-reservation';
import { ClientReservationCard } from '@/presentation/components/features/client-portal/client-reservation-card';

type Tab = 'upcoming' | 'past';

export default function ClientReservationsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data: reservations, isLoading } = useMyReservations();

  const all = reservations ?? [];
  const list =
    tab === 'upcoming'
      ? all.filter(isUpcoming)
      : all.filter((r) => !isUpcoming(r)).sort((a, b) => +b.scheduledAt - +a.scheduledAt);

  return (
    <div className="space-y-4">
      <h1
        className="text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Mis reservas
      </h1>

      <div
        role="tablist"
        aria-label="Filtro de reservas"
        className="flex gap-1 rounded-lg bg-[var(--bg-sunken)] p-1"
      >
        {(
          [
            ['upcoming', 'Próximas'],
            ['past', 'Pasadas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'flex-1 rounded-md py-2 text-[13.5px] font-semibold transition-colors',
              tab === value
                ? 'bg-[var(--bg-surface)] text-[var(--fg-strong)] shadow-sm'
                : 'text-[var(--fg-secondary)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-10 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <CalendarDays className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
            {tab === 'upcoming' ? 'Sin reservas próximas' : 'Sin historial todavía'}
          </p>
          {tab === 'upcoming' && (
            <Button asChild className="mt-5">
              <Link href="/explorar">
                <Compass className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Explorar negocios
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <ClientReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      )}
    </div>
  );
}
