import type { DebtRepository } from '@/domain/repositories/debt.repository';
import type { AddManualDebtInput } from '@/domain/entities/debt';

export class AddManualDebtUseCase {
  constructor(private repo: DebtRepository) {}
  execute(input: AddManualDebtInput): Promise<void> {
    return this.repo.addManual(input);
  }
}
