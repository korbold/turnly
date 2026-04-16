import type { ReportRepository } from '@/domain/repositories/report.repository';

export class GetDailyReportUseCase {
  constructor(private repo: ReportRepository) {}

  execute(date: string) {
    return this.repo.getDaily(date);
  }
}
