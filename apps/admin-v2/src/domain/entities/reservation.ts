export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type ReservationAction = 'confirm' | 'start' | 'complete' | 'cancel' | 'no_show';

export type ReservationItemType = 'service_variant' | 'product';

export type ReservationPaymentStatus = 'unpaid' | 'paid';
export type ReservationPaymentMethod = 'transfer' | 'card' | 'cash';
export type ReservationPaymentTiming =
  | 'prepay_required'
  | 'at_pickup'
  | 'at_completion'
  | 'flexible'
  | 'none';

export interface ReservationItem {
  id: string;
  reservationId: string;
  itemType: ReservationItemType;
  refId: string;
  /** Parent service for variant items. Empty for product lines. */
  serviceId?: string | null;
  label: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
  createdAt?: Date;
}

export interface ReservationItemChange {
  id: string;
  action: 'added' | 'removed' | 'upgraded' | 'downgraded' | 'price_override';
  itemType: string | null;
  label: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  reason: string | null;
  changedBy: { id: string; name: string } | null;
  changedAt: Date;
}

export interface BillingSnapshot {
  docType: 'ruc' | 'cedula' | 'passport' | 'final_consumer';
  docNumber: string;
  legalName: string;
  email: string | null;
  address: string | null;
  phone: string | null;
  source: 'profile' | 'manual';
  capturedAt: string;
}

export interface ReservationClientResource {
  label: string | null;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  type?: string | null;
}

export interface ReservationService {
  name: string;
  price: string;
}

export interface ReservationClient {
  name: string;
  email: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  clientResourceId: string;
  businessResourceId: string | null;
  serviceId: string;
  serviceVariantId: string | null;
  assignedTo: string | null;
  scheduledAt: Date;
  estimatedEnd: Date;
  status: ReservationStatus;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: string;
  createdAt: Date;
  checkedInAt: Date | null;
  billingSnapshot: BillingSnapshot | null;
  paymentStatus: ReservationPaymentStatus;
  paymentMethod: ReservationPaymentMethod | null;
  paidAt: Date | null;
  paymentReference: string | null;
  /** Bank slug (`pichincha`, `pacifico`…) when paid via transfer. Null
      otherwise. Free-form string so tenants can add regional banks. */
  paymentBank: string | null;
  invoiced: boolean;
  invoicedAt: Date | null;
  invoiceExternalId: string | null;
  invoiceStatus: string | null;
  invoiceClaveAcceso: string | null;
  invoiceNumeroAutorizacion: string | null;
  invoiceError: string | null;
  clientResource?: ReservationClientResource;
  service?: ReservationService;
  client?: ReservationClient;
  /** Compact roll-up of every item label so list views can render
      "Lavada + Aspirado +1 más" without firing a /items request per
      row. Backend ships it when `items` is eager-loaded. */
  servicesSummary?: { count: number; labels: string[] };
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  available: number;
}

export interface ReservationFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: ReservationStatus;
  serviceId?: string;
  page?: number;
}
