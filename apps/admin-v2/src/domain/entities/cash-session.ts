/** La caja de un día: una base al abrir, un conteo al cerrar. */
export type CashSessionStatus = 'open' | 'closed';

/**
 * `withdrawal` es el dueño llevándose la recaudación: sale del cajón pero no
 * es un gasto. Mezclarlo con `expense` ensucia cualquier reporte de gastos.
 */
export type CashMovementType = 'expense' | 'withdrawal' | 'deposit';

export interface CashActor {
  id: string;
  name: string;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: Date;
  createdBy: CashActor | null;
}

/**
 * `expectedAmount` y `difference` son `null` mientras la caja está abierta.
 * No es que falten: el backend no los calcula hasta el cierre, a propósito.
 * Si la UI los muestra antes, el cajero copia el número y el arqueo no
 * controla nada.
 */
/** Cuánto efectivo cobró cada persona. Ver `cashByPerson` en la sesión. */
export interface CashByPerson {
  userId: string | null;
  name: string;
  count: number;
  amount: number;
}

export interface CashSession {
  id: string;
  businessDate: string;
  status: CashSessionStatus;
  openingAmount: number;
  openedAt: Date;
  openedBy: CashActor | null;
  closedAt: Date | null;
  closedBy: CashActor | null;
  countedAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  notes: string | null;
  movements: CashMovement[];
  /**
   * Quién cobró cuánto efectivo. `null` mientras la caja está abierta, por la
   * misma razón que `expectedAmount`: sumar estas filas da el esperado.
   *
   * Existe porque el cajón es de varios. Vanessa abre y cierra; Fernanda cobra
   * el 85%. Sin esto, una diferencia se le adjudica entera a quien firmó.
   */
  cashByPerson: CashByPerson[] | null;
}

export interface CashSessionSnapshot {
  session: CashSession | null;
  /** Efectivo cobrado ese día sin caja abierta. Es un aviso, no un bloqueo. */
  cashWithoutSession: number;
  /**
   * Lo que el día registró y nadie cobró todavía.
   *
   * Se puede mostrar con la caja abierta sin romper el conteo ciego: es plata
   * que NO está en el cajón. Sirve para avisar antes de cerrar temprano — el
   * cierre del 24 dejó afuera 8 servicios por $305.
   */
  pendingCollection: { count: number; amount: number };
}

export interface ReopenCashSessionInput {
  sessionId: string;
  /** Sin motivo, reabrir es indistinguible de borrar un arqueo que no gustó. */
  reason: string;
}

export interface OpenCashSessionInput {
  businessDate?: string;
  openingAmount: number;
}

export interface AddCashMovementInput {
  sessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
}

export interface CloseCashSessionInput {
  sessionId: string;
  countedAmount: number;
  notes?: string;
}

export const MOVEMENT_TYPE_LABEL: Record<CashMovementType, string> = {
  expense: 'Egreso',
  withdrawal: 'Retiro',
  deposit: 'Ingreso',
};
