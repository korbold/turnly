import type { NotificationRepository } from '@/domain/repositories/notification.repository';
import type { AppNotification } from '@/domain/entities/app-notification';
import api from '../client';
import { mapNotification } from '../mappers/notification.mapper';

export class ApiNotificationRepository implements NotificationRepository {
  async getAll(unreadOnly = false): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    const params: Record<string, unknown> = {};
    if (unreadOnly) params.unread = true;

    const { data: res } = await api.get('/notifications', { params });
    const notifications = (res.data as Record<string, unknown>[]).map(mapNotification);
    const unreadCount = (res.meta?.unread_count as number) ?? 0;

    return { notifications, unreadCount };
  }

  async markAsRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`);
  }

  async markAllAsRead(): Promise<void> {
    await api.post('/notifications/read-all');
  }

  async registerDeviceToken(token: string, platform: string): Promise<void> {
    await api.post('/device-tokens', { token, platform });
  }

  async removeDeviceToken(token: string): Promise<void> {
    await api.delete(`/device-tokens/${token}`);
  }
}
