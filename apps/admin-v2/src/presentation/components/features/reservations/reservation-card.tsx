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

const BORDER_COLORS: Record<ReservationStatus, string> = {
  pending: 'border-l-amber-500',
  confirmed: 'border-l-sky-500',
  in_progress: 'border-l-indigo-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-rose-500',
  no_show: 'border-l-slate-500',
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

  return (
    <motion.button
      whileHover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      className={cn(
        'w-full rounded-lg border border-l-4 bg-white p-3 text-left transition-shadow',
        BORDER_COLORS[reservation.status]
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {reservation.client?.name ?? 'Cliente'}
          </p>
          {!compact && (
            <p className="truncate text-xs text-muted-foreground">
              {reservation.service?.name ?? 'Servicio'}
              {reservation.clientResource?.plate
                ? ` - ${reservation.clientResource.plate}`
                : ''}
            </p>
          )}
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
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {format(new Date(reservation.scheduledAt), 'HH:mm')} -{' '}
          {format(new Date(reservation.estimatedEnd), 'HH:mm')}
        </span>
        {reservation.assignedTo && !compact && (
          <span className="truncate">
            {/* Employee name would come from join, show ID for now */}
          </span>
        )}
      </div>
    </motion.button>
  );
}
