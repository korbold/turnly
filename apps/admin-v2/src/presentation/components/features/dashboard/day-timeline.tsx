'use client';

import { useMemo } from 'react';
import { format, isSameHour } from 'date-fns';
import { ChevronRight, Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import type {
  Reservation,
  ReservationStatus,
} from '@/domain/entities/reservation';
import { RESERVATION_STATUS_CONFIG } from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';

const STATUS_BORDER: Record<ReservationStatus, string> = {
  pending: 'var(--status-pending-fg)',
  confirmed: 'var(--status-confirmed-fg)',
  checked_in: 'var(--warning-700)',
  in_progress: 'var(--status-progress-fg)',
  completed: 'var(--status-completed-fg)',
  cancelled: 'var(--status-cancelled-fg)',
  no_show: 'var(--status-noshow-fg)',
};

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

interface DayTimelineProps {
  reservations: Reservation[];
  isLoading: boolean;
  now: Date;
  filter: ReservationStatus | null;
  onSelect: (reservation: Reservation) => void;
  onCreateAt?: (hour: number) => void;
}

export function DayTimeline({
  reservations,
  isLoading,
  now,
  filter,
  onSelect,
  onCreateAt,
}: DayTimelineProps) {
  const sorted = useMemo(
    () =>
      reservations
        .slice()
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        ),
    [reservations]
  );

  const filtered = useMemo(
    () => (filter ? sorted.filter((r) => r.status === filter) : sorted),
    [sorted, filter]
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-10 text-center">
        <p className="text-[14px] font-semibold text-[var(--fg-strong)]">
          {filter
            ? 'Sin reservas en este estado'
            : 'No hay reservas para hoy'}
        </p>
        <p className="mt-1 text-[13px] text-[var(--fg-secondary)]">
          {filter
            ? 'Cambia el filtro o registra una visita sin cita.'
            : 'Comparte tu link de reservas o registra una visita sin cita.'}
        </p>
      </div>
    );
  }

  const nowMs = now.getTime();
  let inserted = false;

  const items: Array<
    | { kind: 'hour-label'; hour: Date; key: string }
    | { kind: 'now'; key: string }
    | { kind: 'reservation'; reservation: Reservation; key: string }
  > = [];

  let lastHour: Date | null = null;

  for (const r of filtered) {
    const start = new Date(r.scheduledAt);
    if (!lastHour || !isSameHour(lastHour, start)) {
      items.push({
        kind: 'hour-label',
        hour: start,
        key: `h-${start.toISOString()}`,
      });
      lastHour = start;
    }
    if (!inserted && start.getTime() > nowMs && !filter) {
      items.push({ kind: 'now', key: 'now-marker' });
      inserted = true;
    }
    items.push({
      kind: 'reservation',
      reservation: r,
      key: r.id,
    });
  }

  if (!inserted && !filter && filtered.length > 0) {
    const last = new Date(filtered[filtered.length - 1].estimatedEnd);
    if (last.getTime() < nowMs) {
      items.push({ kind: 'now', key: 'now-marker' });
    }
  }

  return (
    <ol role="list" className="space-y-2">
      {items.map((item) => {
        if (item.kind === 'hour-label') {
          return (
            <li
              key={item.key}
              className="flex items-center gap-3 pt-2 first:pt-0"
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)] tabular-nums"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {format(item.hour, 'HH:00')}
              </span>
              <span
                aria-hidden="true"
                className="h-px flex-1 bg-[var(--border)]"
              />
              {onCreateAt && (
                <button
                  type="button"
                  onClick={() => onCreateAt(item.hour.getHours())}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--fg-muted)] transition-colors hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:underline"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  Sin cita
                </button>
              )}
            </li>
          );
        }

        if (item.kind === 'now') {
          return (
            <li
              key={item.key}
              className="flex items-center gap-2 py-1"
              aria-label="Hora actual"
            >
              <span
                className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--brand-700)]"
              >
                Ahora
              </span>
              <span
                aria-hidden="true"
                className="h-0 flex-1 border-t-2 border-dotted border-[var(--brand-500)]"
              />
              <span
                className="text-[11px] font-semibold tabular-nums text-[var(--brand-700)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {format(now, 'HH:mm')}
              </span>
            </li>
          );
        }

        const { reservation } = item;
        const cfg = RESERVATION_STATUS_CONFIG[reservation.status];
        const start = format(new Date(reservation.scheduledAt), 'HH:mm');
        const end = format(new Date(reservation.estimatedEnd), 'HH:mm');
        const customer = reservation.client?.name ?? 'Cliente';
        const service = reservation.service?.name ?? 'Servicio';

        return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onSelect(reservation)}
              className="group flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{
                borderTopColor: STATUS_BORDER[reservation.status],
                borderTopWidth: '3px',
              }}
            >
              <div
                className="flex w-[64px] shrink-0 flex-col text-[12.5px] font-semibold tabular-nums leading-tight"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <span className="text-[var(--fg-strong)]">{start}</span>
                <span className="text-[11px] text-[var(--fg-muted)]">
                  {end}
                </span>
              </div>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-[var(--ink-75)] text-[12px] font-semibold text-[var(--fg-strong)]">
                  {getInitials(customer)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold leading-snug text-[var(--fg-strong)]">
                  {customer}
                </p>
                <p className="truncate text-[12.5px] text-[var(--fg-secondary)]">
                  {service}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em]',
                  cfg.bgColor,
                  cfg.color
                )}
              >
                {cfg.label}
              </span>
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5 sm:block"
                aria-hidden="true"
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
