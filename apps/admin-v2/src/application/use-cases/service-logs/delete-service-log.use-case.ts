import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';

export class DeleteServiceLogUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string) {
    return this.repo.delete(id);
  }
}
