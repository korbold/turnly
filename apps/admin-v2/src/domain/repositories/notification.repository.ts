import type { AppNotification } from '../entities/app-notification';

export interface NotificationRepository {
  getAll(unreadOnly?: boolean): Promise<{ notifications: AppNotification[]; unreadCount: number }>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  registerDeviceToken(token: string, platform: string): Promise<void>;
  removeDeviceToken(token: string): Promise<void>;
}
