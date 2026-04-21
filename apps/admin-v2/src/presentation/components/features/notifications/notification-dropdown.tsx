'use client';

import { useRouter } from 'next/navigation';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '@/presentation/hooks/use-notifications';
import { NotificationItem } from './notification-item';
import { Button } from '@/presentation/components/ui/button';
import { Separator } from '@/presentation/components/ui/separator';

export function NotificationDropdown() {
  const router = useRouter();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.notifications.slice(0, 8) ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleClick = (notification: typeof notifications[number]) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    if (notification.actionType === 'reservation_detail') {
      router.push('/reservations');
    }
  };

  return (
    <div className="w-96">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Notificaciones</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-auto py-1 text-xs" onClick={() => markAll.mutate()}>
            Marcar todas
          </Button>
        )}
      </div>
      <Separator />
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">Sin notificaciones</p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
          ))
        )}
      </div>
      {notifications.length > 0 && (
        <>
          <Separator />
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-zinc-500"
              onClick={() => router.push('/notifications')}
            >
              Ver todas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
