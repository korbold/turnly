import type {
  CashMovement,
  CashSession,
  CashSessionSnapshot,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
} from '@/domain/entities/cash-session';

/** Sin `reopen`: una caja cerrada no se reabre. Se corrige con un movimiento
    en la caja siguiente. */
export interface CashSessionRepository {
  get(date: string): Promise<CashSessionSnapshot>;
  open(input: OpenCashSessionInput): Promise<CashSession>;
  addMovement(input: AddCashMovementInput): Promise<CashMovement>;
  close(input: CloseCashSessionInput): Promise<CashSession>;
}
