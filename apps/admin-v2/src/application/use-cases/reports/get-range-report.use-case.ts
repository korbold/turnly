import type { ReportRepository } from '@/domain/repositories/report.repository';

export class GetRangeReportUseCase {
  constructor(private repo: ReportRepository) {}

  execute(from: string, to: string) {
    return this.repo.getRange(from, to);
  }
}
