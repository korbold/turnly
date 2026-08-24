import type { ServiceLog, ServiceLogFilters, DailySummary, PaymentMethod } from '../entities/service-log';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateServiceLogItemInput {
  /** Defaults to `service_variant` — the legacy shape. `product` sells
      an inventory item off the shelf and discounts its stock. */
  itemType?: 'service_variant' | 'product';
  /** Required for a service line. */
  serviceId?: string;
  /** Required for a product line. */
  productId?: string;
  /** Variant picked for this line, when the service has variants. The
      backend persists this as the item's `ref_id` so the row points at
      the variant the cashier saw on screen. */
  variantId?: string | null;
  label: string;
  qty: number;
  unitPrice: number;
}

export interface CreateServiceLogData {
  /** Null on a counter sale — a product handed over to a walk-in with
      no vehicle on file. The backend requires it only once a service
      line is present. */
  clientResourceId: string | null;
  /** Primary service. Optional when `items` carries the full breakdown
      — the backend derives it from `items[0]`. */
  serviceId?: string;
  attendedBy: string;
  washedBy?: string | null;
  driedBy?: string | null;
  /** Required only when `items` is not provided. Otherwise the backend
      sums `items[].unitPrice * qty`. */
  priceCharged?: number;
  paymentMethod: PaymentMethod | null;
  paymentBank?: string | null;
  paymentStatus?: 'paid' | 'unpaid';
  /** Abono al registrar. Ausente cobra el total, que es el comportamiento
      histórico. */
  amountReceived?: number;
  /** Multi-service breakdown. Each line maps to a service_log_items
      row; the parent log carries the sum so legacy reports keep
      grouping correctly. */
  items?: CreateServiceLogItemInput[];
  notes?: string;
  /** Motivo del desvío de precio. Obligatorio sin el privilegio Precio. */
  priceChangeReason?: string;
  priceChangeNote?: string;
}

export interface RecordPaymentData {
  method: PaymentMethod;
  bank?: string | null;
  reference?: string | null;
  /** Abono: cobrar menos que el saldo. Ausente cobra todo lo que falta. */
  amount?: number;
}

export interface UpdateServiceLogData {
  serviceId?: string;
  attendedBy?: string;
  priceCharged?: number;
  paymentMethod?: PaymentMethod;
  paymentBank?: string | null;
  notes?: string;
}

export interface ServiceLogItemDraft {
  /** Defaults to `service_variant`. A `product` line must carry
      productId instead of serviceId — sending a product as a service
      line puts its uuid in service_logs.service_id and breaks the
      foreign key. */
  itemType?: 'service_variant' | 'product';
  serviceId?: string;
  productId?: string;
  variantId?: string | null;
  label: string;
  qty: number;
  unitPrice: number;
}

export type UpdateServiceLogItemsData = ServiceLogItemDraft[];

/** Acompaña a la edición cuando alguna línea se apartó de lo que valía.
    Igual que al registrar: el código sale de la lista cerrada, y el backend
    sólo lo exige a quien no tiene el privilegio Precio. */
export interface PriceChangeMeta {
  priceChangeReason?: string;
  priceChangeNote?: string;
}

/** Client fiscal profile the factura reads at emit time. Mirrors the
    admin BillingProfileForm draft shape. */
export interface ServiceLogBillingProfile {
  docType: 'final_consumer' | 'cedula' | 'ruc' | 'passport';
  docNumber: string;
  legalName: string;
  email: string;
  address: string;
  phone: string;
}

/** Omitir un campo es "no lo toques"; mandarlo en null es "sacá al asignado".
    El backend distingue los dos casos, así que el repositorio también. */
export interface AssignStaffData {
  washedBy?: string | null;
  driedBy?: string | null;
}

export interface ServiceLogRepository {
  getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>>;
  getById(id: string): Promise<ServiceLog>;
  create(data: CreateServiceLogData): Promise<ServiceLog>;
  update(id: string, data: UpdateServiceLogData): Promise<ServiceLog>;
  assignStaff(id: string, data: AssignStaffData): Promise<ServiceLog>;
  updateItems(
    id: string,
    items: UpdateServiceLogItemsData,
    meta?: PriceChangeMeta,
  ): Promise<ServiceLog>;
  delete(id: string): Promise<void>;
  /** `leftOwing` convierte el saldo pendiente en deuda. Ausente deja un
      pendiente del día, que es el comportamiento histórico. */
  complete(id: string, leftOwing?: boolean): Promise<ServiceLog>;
  recordPayment(id: string, data: RecordPaymentData): Promise<ServiceLog>;
  /** Deshace TODO lo cobrado del registro. Sólo dueño o admin. */
  voidPayment(id: string): Promise<ServiceLog>;
  getSummary(date: string): Promise<DailySummary>;
  getBilling(id: string): Promise<ServiceLogBillingProfile>;
  updateBilling(id: string, data: ServiceLogBillingProfile): Promise<ServiceLogBillingProfile>;
}
