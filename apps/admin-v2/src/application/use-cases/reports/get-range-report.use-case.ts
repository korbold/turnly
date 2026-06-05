import type { ReportRepository, RangeReportFilters } from '@/domain/repositories/report.repository';

export class GetRangeReportUseCase {
  constructor(private repo: ReportRepository) {}

  execute(from: string, to: string, filters?: RangeReportFilters) {
    return this.repo.getRange(from, to, filters);
  }
}
