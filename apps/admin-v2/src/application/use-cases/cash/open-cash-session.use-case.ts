import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSession, OpenCashSessionInput } from '@/domain/entities/cash-session';

export class OpenCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: OpenCashSessionInput): Promise<CashSession> {
    return this.repo.open(input);
  }
}
