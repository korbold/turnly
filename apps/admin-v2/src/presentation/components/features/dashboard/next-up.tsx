'use client';

import { useMemo } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

type NextUpStatus = 'now' | 'late' | 'upcoming' | 'idle';

interface Resolved {
  reservation: Reservation;
  status: NextUpStatus;
  minutes: number;
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function resolveNextUp(reservations: Reservation[], now: Date): Resolved | null {
  const live = reservations
    .filter((r) =>
      r.status === 'confirmed' ||
      r.status === 'pending' ||
      r.status === 'in_progress'
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

  if (live.length === 0) return null;

  const inProgress = live.find((r) => r.status === 'in_progress');
  if (inProgress) {
    return { reservation: inProgress, status: 'now', minutes: 0 };
  }

  const ongoing = live.find((r) => {
    const start = new Date(r.scheduledAt).getTime();
    const end = new Date(r.estimatedEnd).getTime();
    return start <= now.getTime() && end > now.getTime();
  });
  if (ongoing) {
    return { reservation: ongoing, status: 'now', minutes: 0 };
  }

  const late = live.find(
    (r) =>
      new Date(r.scheduledAt).getTime() < now.getTime() &&
      (r.status === 'pending' || r.status === 'confirmed')
  );
  if (late) {
    return {
      reservation: late,
      status: 'late',
      minutes: Math.max(
        1,
        differenceInMinutes(now, new Date(late.scheduledAt))
      ),
    };
  }

  const upcoming = live.find(
    (r) => new Date(r.scheduledAt).getTime() > now.getTime()
  );
  if (upcoming) {
    return {
      reservation: upcoming,
      status: 'upcoming',
      minutes: Math.max(
        1,
        differenceInMinutes(new Date(upcoming.scheduledAt), now)
      ),
    };
  }

  return null;
}

function formatCountdown(status: NextUpStatus, minutes: number): string {
  if (status === 'now') return 'Ahora';
  if (status === 'late') return `Atrasada · ${minutes} min`;
  if (minutes <= 5) return `En ${minutes} min`;
  if (minutes < 60) return `En ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `En ${hours} h` : `En ${hours} h ${mins} min`;
}

interface NextUpProps {
  reservations: Reservation[];
  now: Date;
  isLoading: boolean;
  greeting: string;
  firstName: string;
  onOpenDetail: (reservation: Reservation) => void;
}

export function NextUp({
  reservations,
  now,
  isLoading,
  greeting,
  firstName,
  onOpenDetail,
}: NextUpProps) {
  const next = useMemo(() => resolveNextUp(reservations, now), [reservations, now]);

  if (isLoading) {
    return (
      <section
        aria-label="Próxima cita"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
      >
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-56" />
      </section>
    );
  }

  if (!next) {
    return (
      <section
        aria-label="Próxima cita"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>
        <p
          className="mt-2 text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-display)', fontStretch: '90%', letterSpacing: '-0.01em' }}
        >
          Nada en agenda por ahora.
        </p>
        <p className="mt-1 text-[14px] leading-snug text-[var(--fg-secondary)]">
          Sigue tu día. Las visitas sin cita también cuentan.
        </p>
      </section>
    );
  }

  const { reservation, status, minutes } = next;
  const time = format(new Date(reservation.scheduledAt), 'HH:mm');
  const dayLabel = format(new Date(reservation.scheduledAt), "EEEE d 'de' MMMM", {
    locale: es,
  });
  const customer = reservation.client?.name ?? 'Cliente';
  const service = reservation.service?.name ?? 'Servicio';

  const isHot = status === 'now' || status === 'late';

  return (
    <section
      aria-label="Próxima cita"
      className={cn(
        'relative overflow-hidden rounded-xl border p-5 transition-colors',
        isHot
          ? 'border-[var(--brand-200)] bg-[var(--brand-50)]'
          : 'border-[var(--border)] bg-[var(--bg-surface)]'
      )}
    >
      <header className="flex items-center justify-between">
        <p
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.04em]',
            isHot ? 'text-[var(--brand-700)]' : 'text-[var(--fg-muted)]'
          )}
        >
          {greeting}{firstName ? `, ${firstName}` : ''} · {dayLabel}
        </p>
      </header>

      <button
        type="button"
        onClick={() => onOpenDetail(reservation)}
        className="mt-3 flex w-full items-center gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.04em]',
              isHot ? 'text-[var(--brand-700)]' : 'text-[var(--fg-muted)]'
            )}
          >
            {status === 'now'
              ? 'En este momento'
              : status === 'late'
                ? 'Atrasada'
                : 'Próxima cita'}
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className={cn(
                'text-[28px] font-bold leading-none tabular-nums',
                isHot ? 'text-[var(--brand-700)]' : 'text-[var(--fg-strong)]'
              )}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {time}
            </span>
            <span
              className={cn(
                'text-[13px] font-semibold',
                isHot ? 'text-[var(--brand-700)]' : 'text-[var(--fg-secondary)]'
              )}
            >
              {formatCountdown(status, minutes)}
            </span>
          </div>
          <p className="mt-2 truncate text-[17px] font-semibold leading-snug text-[var(--fg-strong)]">
            {customer}
          </p>
          <p className="mt-0.5 truncate text-[14px] text-[var(--fg-secondary)]">
            {service}
          </p>
        </div>
        <Avatar className="h-12 w-12 shrink-0 border border-[var(--border)]">
          <AvatarFallback
            className={cn(
              'text-[14px] font-semibold',
              isHot
                ? 'bg-white text-[var(--brand-700)]'
                : 'bg-[var(--ink-75)] text-[var(--fg-strong)]'
            )}
          >
            {getInitials(customer)}
          </AvatarFallback>
        </Avatar>
        <ArrowRight
          className={cn(
            'h-4 w-4 shrink-0',
            isHot ? 'text-[var(--brand-700)]' : 'text-[var(--fg-muted)]'
          )}
          aria-hidden="true"
        />
      </button>
    </section>
  );
}
