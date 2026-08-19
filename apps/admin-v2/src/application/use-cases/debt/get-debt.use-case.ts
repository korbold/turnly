import type { DebtRepository } from '@/domain/repositories/debt.repository';
import type { Debt } from '@/domain/entities/debt';

export class GetDebtUseCase {
  constructor(private repo: DebtRepository) {}
  execute(clientResourceId: string): Promise<Debt> {
    return this.repo.get(clientResourceId);
  }
}
