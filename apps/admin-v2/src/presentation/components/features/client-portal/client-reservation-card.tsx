'use client';

import Link from 'next/link';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { ClientReservation } from '@/domain/entities/client-reservation';
import type { ReservationStatus } from '@/domain/entities/reservation';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  checked_in: 'En el local',
  in_progress: 'En proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asististe',
};

const STATUS_CLASS: Record<ReservationStatus, string> = {
  pending: 'bg-[var(--warning-50)] text-[var(--warning-700)]',
  confirmed: 'bg-[var(--success-50)] text-[var(--success-700)]',
  checked_in: 'bg-[var(--info-50)] text-[var(--info-700)]',
  in_progress: 'bg-[var(--info-50)] text-[var(--info-700)]',
  completed: 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
  cancelled: 'bg-[var(--danger-50)] text-[var(--danger-700)]',
  no_show: 'bg-[var(--danger-50)] text-[var(--danger-700)]',
};

/** "Hoy · 14:30" reads faster at a glance than a full date. */
export function formatWhen(date: Date): string {
  const time = format(date, 'HH:mm');
  if (isToday(date)) return `Hoy · ${time}`;
  if (isTomorrow(date)) return `Mañana · ${time}`;
  return `${format(date, "d 'de' MMM", { locale: es })} · ${time}`;
}

export function ClientReservationCard({ reservation }: { reservation: ClientReservation }) {
  const title = reservation.business?.name ?? 'Negocio';
  const subtitle =
    reservation.items.length > 0
      ? reservation.items.map((i) => i.label).join(' · ')
      : (reservation.service?.name ?? '');

  return (
    <Link
      href={`/app/reservas/${reservation.id}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-[var(--fg-strong)]">{title}</p>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.03em]',
              STATUS_CLASS[reservation.status],
            )}
          >
            {STATUS_LABEL[reservation.status]}
          </span>
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-[13px] text-[var(--fg-secondary)]">{subtitle}</p>
        )}
        <p
          className="mt-1.5 text-[13px] font-semibold tabular-nums text-[var(--fg)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatWhen(reservation.scheduledAt)}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
    </Link>
  );
}
