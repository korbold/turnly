import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSession, CloseCashSessionInput } from '@/domain/entities/cash-session';

export class CloseCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: CloseCashSessionInput): Promise<CashSession> {
    return this.repo.close(input);
  }
}
