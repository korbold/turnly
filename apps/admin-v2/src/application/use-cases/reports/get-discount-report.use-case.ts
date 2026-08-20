import type { ReportRepository } from '@/domain/repositories/report.repository';

export class GetDiscountReportUseCase {
  constructor(private repo: ReportRepository) {}

  execute(from: string, to: string) {
    return this.repo.getDiscounts(from, to);
  }
}
