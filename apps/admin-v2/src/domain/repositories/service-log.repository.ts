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
  clientResourceId: string;
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
  /** Multi-service breakdown. Each line maps to a service_log_items
      row; the parent log carries the sum so legacy reports keep
      grouping correctly. */
  items?: CreateServiceLogItemInput[];
  notes?: string;
}

export interface RecordPaymentData {
  method: PaymentMethod;
  bank?: string | null;
  reference?: string | null;
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
  serviceId: string;
  variantId: string | null;
  label: string;
  qty: number;
  unitPrice: number;
}

export type UpdateServiceLogItemsData = ServiceLogItemDraft[];

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
  updateItems(id: string, items: UpdateServiceLogItemsData): Promise<ServiceLog>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<ServiceLog>;
  recordPayment(id: string, data: RecordPaymentData): Promise<ServiceLog>;
  getSummary(date: string): Promise<DailySummary>;
  getBilling(id: string): Promise<ServiceLogBillingProfile>;
  updateBilling(id: string, data: ServiceLogBillingProfile): Promise<ServiceLogBillingProfile>;
}
