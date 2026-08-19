import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSessionSnapshot } from '@/domain/entities/cash-session';

export class GetCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(date: string): Promise<CashSessionSnapshot> {
    return this.repo.get(date);
  }
}
