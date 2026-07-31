'use client';

import type { AppNotification } from '@/domain/entities/app-notification';
import { cn } from '@/shared/utils/cn';
import {
  CalendarCheck,
  CalendarX,
  CalendarClock,
  CalendarPlus,
  PackageMinus,
  BellRing,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItemProps {
  notification: AppNotification;
  onClick?: () => void;
}

const ICON_MAP: Record<string, { icon: typeof BellRing; color: string; bg: string }> = {
  check_circle: { icon: CalendarCheck, color: 'text-green-600', bg: 'bg-green-50' },
  cancel: { icon: CalendarX, color: 'text-red-600', bg: 'bg-red-50' },
  edit_calendar: { icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50' },
  calendar_today: { icon: CalendarPlus, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-muted)]' },
  inventory: { icon: PackageMinus, color: 'text-amber-600', bg: 'bg-amber-50' },
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const iconConfig = ICON_MAP[notification.icon ?? ''] ?? {
    icon: BellRing,
    color: 'text-zinc-600',
    bg: 'bg-zinc-50',
  };
  const Icon = iconConfig.icon;

  const timeAgo = formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es });

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-zinc-50',
        !notification.readAt && 'bg-[var(--color-primary-muted)]/50',
      )}
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconConfig.bg)}>
        <Icon className={cn('h-4 w-4', iconConfig.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', !notification.readAt ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700')}>
            {notification.title}
          </p>
          {!notification.readAt && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{notification.body}</p>
        <p className="mt-1 text-xs text-zinc-400">{timeAgo}</p>
      </div>
    </button>
  );
}
