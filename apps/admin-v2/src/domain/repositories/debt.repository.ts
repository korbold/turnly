import type {
  ClientDebt,
  Debt, AddManualDebtInput, PayDebtInput, PayClientDebtInput,
} from '@/domain/entities/debt';

/** Sin `remove`: una deuda cargada a mano se salda cobrándola, no borrándola.
    Borrarla dejaría el historial sin explicar por qué desapareció. */
export interface DebtRepository {
  get(clientResourceId: string): Promise<Debt>;
  /** La deuda de una persona: la de todos sus vehículos. */
  getForClient(clientId: string): Promise<ClientDebt>;
  /** Un pago repartido entre las deudas de sus vehículos, del más viejo al
      más nuevo. */
  payForClient(input: PayClientDebtInput): Promise<void>;
  addManual(input: AddManualDebtInput): Promise<void>;
  pay(input: PayDebtInput): Promise<void>;
}
