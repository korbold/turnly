import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';
import type { ServiceLogFilters } from '@/domain/entities/service-log';

export class GetServiceLogsUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(filters: ServiceLogFilters) {
    return this.repo.getAll(filters);
  }
}
