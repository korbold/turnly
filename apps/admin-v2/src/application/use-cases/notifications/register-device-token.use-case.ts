import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class RegisterDeviceTokenUseCase {
  constructor(private repo: NotificationRepository) {}
  execute(token: string, platform: string) {
    return this.repo.registerDeviceToken(token, platform);
  }
}
