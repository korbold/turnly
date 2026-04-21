import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class GetNotificationsUseCase {
  constructor(private repo: NotificationRepository) {}
  execute(unreadOnly?: boolean) {
    return this.repo.getAll(unreadOnly);
  }
}
