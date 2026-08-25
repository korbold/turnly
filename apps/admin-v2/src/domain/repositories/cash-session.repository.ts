import type {
  CashMovement,
  ReopenCashSessionInput,
  CashSession,
  CashSessionSnapshot,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
} from '@/domain/entities/cash-session';

export interface CashSessionRepository {
  get(date: string): Promise<CashSessionSnapshot>;
  open(input: OpenCashSessionInput): Promise<CashSession>;
  addMovement(input: AddCashMovementInput): Promise<CashMovement>;
  close(input: CloseCashSessionInput): Promise<CashSession>;
  /** Deshacer un cierre prematuro. El backend sólo se lo permite al dueño. */
  reopen(input: ReopenCashSessionInput): Promise<CashSession>;
}
