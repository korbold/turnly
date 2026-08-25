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

/**
 * Un arqueo firmado. Si la caja se reabrió, este cierre quedó atrás y lleva
 * quién lo reabrió y por qué: la historia de la caja es la lista completa, no
 * la última versión.
 */
export interface CashClosure {
  id: string;
  countedAmount: number;
  countedBreakdown: CashBreakdown | null;
  expectedAmount: number;
  difference: number;
  closedAt: Date;
  closedBy: CashActor | null;
  notes: string | null;
  reopenedAt: Date | null;
  reopenedBy: CashActor | null;
  reopenReason: string | null;
}

/** Una caja con todo lo que se le hizo. */
export interface CashSessionDetail extends CashSession {
  closures: CashClosure[];
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

/**
 * El conteo del cajón, denominación por denominación. Las monedas van en
 * CENTAVOS ('25' es la de veinticinco): el backend usa esas claves porque un
 * punto adentro de una clave rompe la validación de Laravel.
 */
export interface CashBreakdown {
  bills: Record<string, number>;
  coins: Record<string, number>;
  /** Vales, cheques, vouchers: están en el cajón y cuentan. */
  otherAmount?: number;
  otherNote?: string;
}

/** Billetes y monedas que circulan en Ecuador, de mayor a menor. */
export const CASH_BILLS = ['100', '50', '20', '10', '5', '1'] as const;
export const CASH_COINS = ['100', '50', '25', '10', '5', '1'] as const;

/** Cuánto suma un conteo. Espeja `CashCount::total` del backend, que es quien
    decide el número guardado — esto sólo lo muestra mientras se cuenta. */
export function breakdownTotal(b: CashBreakdown): number {
  let centavos = 0;
  for (const v of CASH_BILLS) centavos += (b.bills[v] ?? 0) * Number(v) * 100;
  for (const v of CASH_COINS) centavos += (b.coins[v] ?? 0) * Number(v);
  centavos += Math.round((b.otherAmount ?? 0) * 100);
  return centavos / 100;
}

export interface CloseCashSessionInput {
  sessionId: string;
  /** El conteo. El total lo calcula el backend a partir de esto. */
  breakdown: CashBreakdown;
  notes?: string;
}

export const MOVEMENT_TYPE_LABEL: Record<CashMovementType, string> = {
  expense: 'Egreso',
  withdrawal: 'Retiro',
  deposit: 'Ingreso',
};
