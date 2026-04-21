'use client';

import { format, isToday } from 'date-fns';
import { RESERVATION_STATUS_CONFIG } from '@/shared/constants/status';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

const MAX_VISIBLE = 3;

const BORDER_COLORS: Record<string, string> = {
  pending: 'border-l-amber-500',
  confirmed: 'border-l-sky-500',
  in_progress: 'border-l-indigo-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-rose-500',
  no_show: 'border-l-slate-500',
};

interface CalendarDayCellProps {
  date: Date;
  reservations: Reservation[];
  isCurrentMonth: boolean;
  onSelectDay: (date: Date) => void;
  onSelectReservation: (reservation: Reservation) => void;
}

export function CalendarDayCell({
  date,
  reservations,
  isCurrentMonth,
  onSelectDay,
  onSelectReservation,
}: CalendarDayCellProps) {
  const visible = reservations.slice(0, MAX_VISIBLE);
  const overflow = reservations.length - MAX_VISIBLE;

  function getClientName(r: Reservation): string {
    const data = r.clientResource?.data as Record<string, unknown> | null | undefined;
    if (data) {
      const field = Object.entries(data).find(
        ([k, v]) => k.startsWith('field_') && typeof v === 'string' && v.trim()
      );
      if (field) return field[1] as string;
    }
    return r.clientResource?.plate ?? r.client?.name ?? 'Cliente';
  }

  return (
    <div
      className={cn(
        'min-h-[100px] border-b border-r p-1',
        !isCurrentMonth && 'bg-zinc-50'
      )}
    >
      <button
        onClick={() => onSelectDay(date)}
        className={cn(
          'mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium hover:bg-indigo-50',
          isToday(date) && 'bg-indigo-600 text-white hover:bg-indigo-700',
          !isCurrentMonth && 'text-zinc-400'
        )}
      >
        {format(date, 'd')}
      </button>

      <div className="space-y-0.5">
        {visible.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectReservation(r)}
            className={cn(
              'flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-left text-[11px] leading-tight hover:opacity-80',
              BORDER_COLORS[r.status] ?? 'border-l-zinc-400'
            )}
          >
            <span className="shrink-0 font-medium text-zinc-600">
              {format(new Date(r.scheduledAt), 'HH:mm')}
            </span>
            <span className="truncate text-zinc-500">
              {getClientName(r)}
            </span>
          </button>
        ))}

        {overflow > 0 && (
          <button
            onClick={() => onSelectReservation(reservations[MAX_VISIBLE])}
            className="w-full rounded px-1 py-0.5 text-left text-[11px] text-indigo-600 hover:bg-indigo-50"
          >
            +{overflow} más
          </button>
        )}
      </div>
    </div>
  );
}
