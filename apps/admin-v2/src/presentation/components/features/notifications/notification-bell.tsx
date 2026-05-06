'use client';

import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import { useUnreadCount, useRegisterPushToken } from '@/presentation/hooks/use-notifications';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const { needsPrompt, enableNotifications } = useRegisterPushToken();
  const unreadCount = useUnreadCount();

  if (needsPrompt) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative text-amber-500 hover:text-amber-600"
        onClick={enableNotifications}
        title="Toca para activar notificaciones"
      >
        <BellOff className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-zinc-500 hover:text-zinc-700">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <NotificationDropdown />
      </PopoverContent>
    </Popover>
  );
}
