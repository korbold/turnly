'use client';

import { useRouter } from 'next/navigation';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '@/presentation/hooks/use-notifications';
import { NotificationItem } from '@/presentation/components/features/notifications/notification-item';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

export default function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleClick = (notification: typeof notifications[number]) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    if (notification.actionType === 'reservation_detail') {
      router.push('/reservations');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notificaciones</CardTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
              Marcar todas como leídas
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-400">Sin notificaciones</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
