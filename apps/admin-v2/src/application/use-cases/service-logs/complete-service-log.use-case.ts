import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';

export class CompleteServiceLogUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, leftOwing?: boolean) {
    return this.repo.complete(id, leftOwing);
  }
}
