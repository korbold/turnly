export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type ServiceLogStatus = 'in_progress' | 'completed';

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
  lineTotal: number;
  sortOrder: number;
}

export interface ServiceLogEvent {
  id: string;
  event:
    | 'created'
    | 'assignee_changed'
    | 'items_changed'
    | 'log_updated'
    | 'payment_recorded'
    | 'status_changed'
    | 'invoice_requested'
    | 'invoice_status_changed';
  detail: Record<string, unknown>;
  changedAt: Date;
  /** Null = lo hizo el sistema (el veredicto del SRI, vía job). */
  changedBy: { id: string; name: string } | null;
}

export interface ServiceLog {
  id: string;
  clientResourceId: string;
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
  /** Lo abonado y lo que falta, del libro de pagos. */
  amountPaid: number;
  amountDue: number;
  paidAt: Date | null;
  invoiced: boolean;
  invoicedAt: Date | null;
  invoiceStatus: 'pendiente' | 'enviada' | 'autorizada' | 'rechazada' | null;
  invoiceExternalId: string | null;
  invoiceClaveAcceso: string | null;
  invoiceNumeroAutorizacion: string | null;
  invoiceError: string | null;
  status: ServiceLogStatus;
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
