'use client';

import { useMemo } from 'react';
import type { Reservation, ReservationStatus } from '@/domain/entities/reservation';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';

const BASE_ORDER: ReservationStatus[] = [
  'confirmed',
  'pending',
  'completed',
  'cancelled',
];

const EXTRA_ORDER: ReservationStatus[] = ['in_progress', 'no_show'];

const LABELS: Record<ReservationStatus, string> = {
  confirmed: 'confirmadas',
  pending: 'pendientes',
  in_progress: 'en progreso',
  completed: 'completadas',
  cancelled: 'canceladas',
  no_show: 'no-show',
};

const TONES: Record<ReservationStatus, { fg: string; bg: string }> = {
  confirmed: { fg: 'var(--status-confirmed-fg)', bg: 'var(--status-confirmed-bg)' },
  pending: { fg: 'var(--status-pending-fg)', bg: 'var(--status-pending-bg)' },
  in_progress: { fg: 'var(--status-progress-fg)', bg: 'var(--status-progress-bg)' },
  completed: { fg: 'var(--status-completed-fg)', bg: 'var(--status-completed-bg)' },
  cancelled: { fg: 'var(--status-cancelled-fg)', bg: 'var(--status-cancelled-bg)' },
  no_show: { fg: 'var(--status-noshow-fg)', bg: 'var(--status-noshow-bg)' },
};

interface DayStatsProps {
  reservations: Reservation[];
  isLoading: boolean;
  activeFilter: ReservationStatus | null;
  onFilterChange: (status: ReservationStatus | null) => void;
}

export function DayStats({
  reservations,
  isLoading,
  activeFilter,
  onFilterChange,
}: DayStatsProps) {
  const counts = useMemo(() => {
    const acc: Record<ReservationStatus, number> = {
      pending: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const r of reservations) acc[r.status] += 1;
    return acc;
  }, [reservations]);

  const showAll = [
    ...BASE_ORDER,
    ...EXTRA_ORDER.filter((s) => counts[s] > 0),
  ];

  if (isLoading) {
    return (
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Resumen del día"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {showAll.map((status) => {
        const count = counts[status];
        const isActive = activeFilter === status;
        const tone = TONES[status];
        return (
          <button
            key={status}
            type="button"
            onClick={() =>
              onFilterChange(isActive ? null : count === 0 ? null : status)
            }
            disabled={count === 0}
            aria-pressed={isActive}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-default disabled:opacity-60',
              isActive
                ? 'border-transparent shadow-xs'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
            )}
            style={
              isActive
                ? { backgroundColor: tone.bg, color: tone.fg }
                : undefined
            }
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: tone.fg }}
              aria-hidden="true"
            />
            <span
              className="tabular-nums font-semibold"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {count}
            </span>
            <span className="text-[var(--fg)]">{LABELS[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
