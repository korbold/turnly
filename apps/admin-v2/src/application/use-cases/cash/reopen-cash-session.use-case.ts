import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSession, ReopenCashSessionInput } from '@/domain/entities/cash-session';

/** Deshacer un cierre prematuro. Quién puede lo decide el backend. */
export class ReopenCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: ReopenCashSessionInput): Promise<CashSession> {
    return this.repo.reopen(input);
  }
}
