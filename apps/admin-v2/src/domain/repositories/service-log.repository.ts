import type { ServiceLog, ServiceLogFilters, DailySummary, PaymentMethod } from '../entities/service-log';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateServiceLogItemInput {
  serviceId: string;
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

export interface ServiceLogRepository {
  getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>>;
  getById(id: string): Promise<ServiceLog>;
  create(data: CreateServiceLogData): Promise<ServiceLog>;
  update(id: string, data: UpdateServiceLogData): Promise<ServiceLog>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<ServiceLog>;
  recordPayment(id: string, data: RecordPaymentData): Promise<ServiceLog>;
  getSummary(date: string): Promise<DailySummary>;
}
