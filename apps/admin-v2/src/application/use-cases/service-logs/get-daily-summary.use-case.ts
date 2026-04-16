import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';

export class GetDailySummaryUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(date: string) {
    return this.repo.getSummary(date);
  }
}
