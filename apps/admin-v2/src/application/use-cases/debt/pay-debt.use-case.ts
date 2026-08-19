import type { DebtRepository } from '@/domain/repositories/debt.repository';
import type { PayDebtInput } from '@/domain/entities/debt';

export class PayDebtUseCase {
  constructor(private repo: DebtRepository) {}
  execute(input: PayDebtInput): Promise<void> {
    return this.repo.pay(input);
  }
}
