import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashMovement, AddCashMovementInput } from '@/domain/entities/cash-session';

export class AddCashMovementUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: AddCashMovementInput): Promise<CashMovement> {
    return this.repo.addMovement(input);
  }
}
