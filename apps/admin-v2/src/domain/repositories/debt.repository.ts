import type {
  Debt, AddManualDebtInput, PayDebtInput,
} from '@/domain/entities/debt';

/** Sin `remove`: una deuda cargada a mano se salda cobrándola, no borrándola.
    Borrarla dejaría el historial sin explicar por qué desapareció. */
export interface DebtRepository {
  get(clientResourceId: string): Promise<Debt>;
  addManual(input: AddManualDebtInput): Promise<void>;
  pay(input: PayDebtInput): Promise<void>;
}
