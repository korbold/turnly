import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class MarkAllReadUseCase {
  constructor(private repo: NotificationRepository) {}
  execute() {
    return this.repo.markAllAsRead();
  }
}
