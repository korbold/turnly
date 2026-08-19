/** De dónde sale una línea de deuda: un servicio que se fue sin pagar, o la
    libreta que el dueño llevaba antes del sistema. */
export type DebtItemType = 'service_log' | 'manual_debt';

export interface DebtItem {
  type: DebtItemType;
  id: string;
  label: string;
  /** Cuándo se generó la deuda, no cuándo se cargó. Es el orden del cobro. */
  date: string;
  amount: number;
  paid: number;
  due: number;
}

/** A qué se aplicó una parte de un pago. La etiqueta sobrevive a la deuda:
    cuando se salda desaparece del detalle, pero el historial la sigue
    nombrando. */
export interface DebtPaymentAllocation {
  type: DebtItemType;
  id: string;
  label: string;
  date: string;
  amount: number;
}

export interface DebtPaymentRecord {
  id: string;
  amount: number;
  method: string;
  paidAt: Date;
  allocations: DebtPaymentAllocation[];
}

export interface Debt {
  clientResourceId: string;
  total: number;
  /** De la más vieja a la más nueva: ese orden ES el reparto por defecto. */
  items: DebtItem[];
  payments: DebtPaymentRecord[];
}

export interface DebtAllocationInput {
  type: DebtItemType;
  id: string;
  amount: number;
}

export interface AddManualDebtInput {
  clientResourceId: string;
  amount: number;
  reason: string;
  incurredOn: string;
}

export interface PayDebtInput {
  clientResourceId: string;
  amount: number;
  method: 'cash' | 'card' | 'transfer' | 'other';
  bank?: string | null;
  /** Ausente = reparto del más viejo al más nuevo. */
  allocations?: DebtAllocationInput[];
}

export const DEBT_ITEM_LABEL: Record<DebtItemType, string> = {
  service_log: 'Servicio',
  manual_debt: 'Cargado a mano',
};

/**
 * El reparto que el backend va a hacer, calculado en el navegador para
 * mostrarlo antes de confirmar. Tiene que dar el mismo resultado que
 * `DebtLedger::planFor`: mismo orden, mismo tope por línea.
 */
export function planFor(items: DebtItem[], amount: number): DebtAllocationInput[] {
  let left = Math.round(amount * 100) / 100;
  const plan: DebtAllocationInput[] = [];

  for (const item of items) {
    if (left <= 0.005) break;
    const applied = Math.min(left, item.due);
    plan.push({ type: item.type, id: item.id, amount: Math.round(applied * 100) / 100 });
    left = Math.round((left - applied) * 100) / 100;
  }

  return plan;
}
