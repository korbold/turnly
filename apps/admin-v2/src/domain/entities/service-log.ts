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

export interface ServiceLog {
  id: string;
  clientResourceId: string;
  serviceId: string;
  reservationId: string | null;
  attendedBy: string;
  createdBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  priceCharged: number;
  paymentMethod: PaymentMethod | null;
  paymentBank: string | null;
  paymentStatus: 'paid' | 'unpaid';
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

export interface ServiceLogFilters {
  date?: string;
  page?: number;
}
