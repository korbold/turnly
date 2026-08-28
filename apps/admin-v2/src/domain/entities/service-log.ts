export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type ServiceLogStatus = 'in_progress' | 'completed' | 'cancelled';

export interface ServiceLogClientResource {
  label?: string | null;
  plate: string | null;
  brand: string | null;
  client?: { name: string; email?: string };
}

export interface ServiceLogService {
  name: string;
}

export interface ServiceLogAttendant {
  name: string;
}

export interface ServiceLogItem {
  id: string;
  itemType: 'service_variant' | 'product';
  refId: string;
  /** The service UUID that owns this item. For variant items refId is the
      variant UUID — serviceId is exposed separately by the API (via the
      items.variant eager-load) so the edit dialog can send a correct
      service_id to the updateItems endpoint without a secondary lookup. */
  serviceId: string;
  label: string;
  qty: number;
  unitPrice: number;
  /** La foto del catálogo al registrar la línea. `null` en filas anteriores a
      la feature de descuentos: sin foto no hay desvío que medir. */
  catalogPrice: number | null;
  lineTotal: number;
  sortOrder: number;
}

/** El desvío del catálogo de una fila, listo para pintar en la lista del día.
    `null` cuando se cobró el precio del catálogo. */
export interface PriceChange {
  catalog: number;
  charged: number;
  /** Negativa cuando se cobró de menos. Es el signo que importa. */
  difference: number;
  reasonCode: string | null;
  reasonLabel: string;
  note: string | null;
  /** Cuántas veces se tocó el precio de este registro. */
  changes: number;
  /** Quién lo tocó la última vez — el autor real, de la bitácora, no el
      `attendedBy` de la fila. */
  by: string | null;
  at: Date | null;
}

export interface ServiceLogEvent {
  id: string;
  event:
    | 'created'
    | 'assignee_changed'
    | 'resource_assigned'
    | 'items_changed'
    | 'price_changed'
    | 'log_updated'
    | 'payment_recorded'
    | 'payment_reverted'
    | 'log_cancelled'
    | 'left_owing'
    | 'status_changed'
    | 'invoice_requested'
    | 'invoice_status_changed';
  detail: Record<string, unknown>;
  changedAt: Date;
  /** Null = lo hizo el sistema (el veredicto del SRI, vía job). */
  changedBy: { id: string; name: string } | null;
}

/** Un tramo de cobro: cuánto entró por un método, y por qué banco si aplica. */
export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
  bank: string | null;
}

export interface ServiceLog {
  id: string;
  /** Null on a counter sale — the ticket is not attached to a vehicle. */
  clientResourceId: string | null;
  serviceId: string;
  reservationId: string | null;
  attendedBy: string;
  /** Catálogo service_staff, no usuarios de la app: quién lavó y quién secó.
      Sólo los usa car_wash. */
  washedBy: string | null;
  driedBy: string | null;
  createdBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  priceCharged: number;
  paymentMethod: PaymentMethod | null;
  paymentBank: string | null;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  /**
   * Con qué métodos se cobró, en el orden en que entró la plata. Un solo
   * tramo en el caso normal; dos o más cuando el ticket se pagó partido.
   *
   * La fila mostraba un único chip tomado de `paymentMethod`, que guarda el
   * último método usado: un cobro de $60 en efectivo más $14 en transferencia
   * se anunciaba entero como transferencia y el mostrador no podía verlo.
   */
  paymentBreakdown: PaymentSplit[];
  /** Lo abonado y lo que falta, del libro de pagos. */
  amountPaid: number;
  amountDue: number;
  /** Se llevó el vehículo debiendo. Es lo que separa deuda de olvido. */
  leftOwing: boolean;
  /** Lo que esta placa debe APARTE de este servicio: la deuda vieja que el
      mostrador puede pedir al cobrar. */
  otherDebt: number;
  paidAt: Date | null;
  invoiced: boolean;
  invoicedAt: Date | null;
  invoiceStatus: 'pendiente' | 'enviada' | 'autorizada' | 'rechazada' | null;
  invoiceExternalId: string | null;
  invoiceClaveAcceso: string | null;
  invoiceNumeroAutorizacion: string | null;
  invoiceError: string | null;
  status: ServiceLogStatus;
  /** Anulado: la fila sigue visible pero está congelada y fuera de los
      totales. `null` en todo lo que sigue vivo. */
  cancelledAt: Date | null;
  cancelReasonCode: string | null;
  cancelReasonLabel: string | null;
  cancelReasonNote: string | null;
  notes: string | null;
  logDate: string;
  createdAt: Date;
  events?: ServiceLogEvent[];
  washer?: { id: string; name: string } | null;
  dryer?: { id: string; name: string } | null;
  clientResource?: ServiceLogClientResource;
  service?: ServiceLogService;
  attendant?: ServiceLogAttendant;
  /** Multi-service breakdown — populated when the backend eager-loaded
      `items`. Empty for legacy single-service rows. */
  items?: ServiceLogItem[];
  servicesSummary?: { count: number; labels: string[] };
  /** Sólo lo trae la lista del día (el backend lo calcula cuando cargó items y
      los cambios de precio). `null` = esta fila cobró lo del catálogo. */
  priceChange?: PriceChange | null;
}

export interface DailySummary {
  totalWashes: number;
  /** Everything registered today, collected or not. */
  totalRevenue: number;
  /** Money actually in the till: paid service logs plus paid reservations. */
  collected: { count: number; total: number };
  byPaymentMethod: Record<string, { count: number; total: number }>;
  byStatus: Record<string, number>;
  /**
   * Charged but not collected yet ("Cobrar al retirar"). Not a payment method
   * — those rows have none — so it travels on its own. collected + unpaid
   * reconcile to totalRevenue.
   */
  unpaid: { count: number; total: number };
}

/**
 * `payment` is one control, mirroring the PAGO column: a state (paid/pending)
 * or a concrete method. They never combine — a pending row has no method yet.
 */
export type PaymentFilter = 'paid' | 'pending' | 'partial' | 'cash' | 'card' | 'transfer';

/** Page sizes the UI offers; "all" collapses the day into a single page. */
export type PageSize = '10' | '15' | '20' | 'all';

export interface ServiceLogFilters {
  date?: string;
  /** Reports list a range instead of a single day. */
  dateFrom?: string;
  dateTo?: string;
  paymentBank?: string;
  page?: number;
  perPage?: PageSize;
  payment?: PaymentFilter;
  status?: 'in_progress' | 'completed';
  /** Free-text search over plate, brand and owner name. */
  q?: string;
}
