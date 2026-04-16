import type { ServiceLogRepository, UpdateServiceLogData } from '@/domain/repositories/service-log.repository';

export class UpdateServiceLogUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, data: UpdateServiceLogData) {
    return this.repo.update(id, data);
  }
}
