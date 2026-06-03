'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  RESERVATION_STATUS_CONFIG,
  type ReservationStatus,
} from '@/shared/constants/status';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

/**
 * Per-status visual tokens: a saturated accent for the left rail + a soft
 * tinted body. Tokens are local on purpose — calendar tints need to be
 * lighter than the badge bg to stay readable on the rest of the body.
 */
const ACCENT: Record<ReservationStatus, { rail: string; tint: string; text: string }> = {
  pending: {
    rail: 'bg-amber-400',
    tint: 'bg-amber-50/70 hover:bg-amber-50',
    text: 'text-amber-700',
  },
  confirmed: {
    rail: 'bg-sky-400',
    tint: 'bg-sky-50/70 hover:bg-sky-50',
    text: 'text-sky-700',
  },
  checked_in: {
    rail: 'bg-orange-400',
    tint: 'bg-orange-50/70 hover:bg-orange-50',
    text: 'text-orange-700',
  },
  in_progress: {
    rail: 'bg-indigo-500',
    tint: 'bg-indigo-50/80 hover:bg-indigo-50',
    text: 'text-indigo-700',
  },
  completed: {
    rail: 'bg-emerald-400',
    tint: 'bg-emerald-50/70 hover:bg-emerald-50',
    text: 'text-emerald-700',
  },
  cancelled: {
    rail: 'bg-rose-400',
    tint: 'bg-rose-50/70 hover:bg-rose-50',
    text: 'text-rose-700',
  },
  no_show: {
    rail: 'bg-slate-400',
    tint: 'bg-slate-50/80 hover:bg-slate-50',
    text: 'text-slate-700',
  },
};

interface ReservationCardProps {
  reservation: Reservation;
  onClick?: () => void;
}

export function ReservationCard({ reservation, onClick }: ReservationCardProps) {
  const statusCfg = RESERVATION_STATUS_CONFIG[reservation.status];
  const accent = ACCENT[reservation.status];

  // Prefer a free-text custom field if the resource has one (the booking
  // form lets clients label their car/pet/etc.); fall back to plate and
  // finally to the account holder.
  const resourceData = reservation.clientResource?.data as
    | Record<string, unknown>
    | null
    | undefined;
  const customLabel = resourceData
    ? (Object.entries(resourceData).find(
        ([k, v]) => k.startsWith('field_') && typeof v === 'string' && v.trim(),
      )?.[1] as string | undefined)
    : undefined;
  const headline =
    customLabel ?? reservation.clientResource?.plate ?? reservation.client?.name ?? 'Cliente';
  const subline = reservation.service?.name;
  const timeLabel = `${format(new Date(reservation.scheduledAt), 'HH:mm')} – ${format(
    new Date(reservation.estimatedEnd),
    'HH:mm',
  )}`;

  return (
    <motion.button
      whileHover={{ y: -1, boxShadow: '0 6px 16px rgba(15,23,42,0.08)' }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={onClick}
      className={cn(
        'group relative flex h-full w-full overflow-hidden rounded-lg text-left',
        'border border-[var(--border)] shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] focus-visible:ring-offset-1',
        accent.tint,
      )}
    >
      {/* Status rail */}
      <span
        className={cn('w-1 shrink-0', accent.rail)}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-1 px-3 py-2">
        {/* Headline row: name + status pill, top-aligned so tall cards
            still read at a glance without scrolling visually. */}
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[var(--fg-strong)]">
              {headline}
            </p>
            <p
              className="mt-0.5 text-[11px] tabular-nums text-[var(--fg-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {timeLabel}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.04em]',
              statusCfg.bgColor,
              accent.text,
            )}
          >
            {statusCfg.label}
          </span>
        </div>

        {subline && (
          <p className="truncate text-[12px] text-[var(--fg-secondary)] leading-snug">
            {subline}
          </p>
        )}
      </div>
    </motion.button>
  );
}
