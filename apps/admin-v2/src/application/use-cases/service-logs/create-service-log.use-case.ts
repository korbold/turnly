import type { ServiceLogRepository, CreateServiceLogData } from '@/domain/repositories/service-log.repository';

export class CreateServiceLogUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(data: CreateServiceLogData) {
    return this.repo.create(data);
  }
}
