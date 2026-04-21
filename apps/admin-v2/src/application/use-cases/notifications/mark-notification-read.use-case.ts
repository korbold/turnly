import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class MarkNotificationReadUseCase {
  constructor(private repo: NotificationRepository) {}
  execute(id: string) {
    return this.repo.markAsRead(id);
  }
}
