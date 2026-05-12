'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Badge } from '@/presentation/components/ui/badge';
import {
  RESERVATION_STATUS_CONFIG,
  type ReservationStatus,
} from '@/shared/constants/status';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

const CARD_STYLES: Record<ReservationStatus, string> = {
  pending: 'border-l-amber-500 bg-amber-50',
  confirmed: 'border-l-sky-500 bg-sky-50',
  in_progress: 'border-l-indigo-500 bg-[var(--color-primary-muted)]',
  completed: 'border-l-emerald-500 bg-emerald-50',
  cancelled: 'border-l-rose-500 bg-rose-50',
  no_show: 'border-l-slate-500 bg-slate-50',
};

interface ReservationCardProps {
  reservation: Reservation;
  onClick?: () => void;
  compact?: boolean;
}

export function ReservationCard({
  reservation,
  onClick,
  compact = false,
}: ReservationCardProps) {
  const statusCfg = RESERVATION_STATUS_CONFIG[reservation.status];

  // Extract client name from resource custom data (dynamic field)
  const resourceData = reservation.clientResource?.data as Record<string, unknown> | null | undefined;
  const clientNameFromResource = resourceData
    ? Object.entries(resourceData).find(
        ([k, v]) => k.startsWith('field_') && typeof v === 'string' && v.trim()
      )?.[1] as string | undefined
    : undefined;

  return (
    <motion.button
      whileHover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      className={cn(
        'flex h-full w-full items-center rounded-lg border border-l-4 px-3 text-left transition-shadow',
        CARD_STYLES[reservation.status]
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <p className="truncate text-sm font-medium">
            {clientNameFromResource ?? reservation.clientResource?.plate ?? reservation.client?.name ?? 'Cliente'}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {format(new Date(reservation.scheduledAt), 'HH:mm')} - {format(new Date(reservation.estimatedEnd), 'HH:mm')}
          </span>
        </div>
        <Badge
          className={cn(
            'shrink-0 border-0 text-[10px]',
            statusCfg.bgColor,
            statusCfg.color
          )}
        >
          {statusCfg.label}
        </Badge>
      </div>
    </motion.button>
  );
}
