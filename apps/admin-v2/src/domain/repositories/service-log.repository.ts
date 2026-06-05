import type { ServiceLog, ServiceLogFilters, DailySummary, PaymentMethod } from '../entities/service-log';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateServiceLogData {
  clientResourceId: string;
  serviceId: string;
  attendedBy: string;
  priceCharged: number;
  paymentMethod: PaymentMethod | null;
  /** Bank slug when paymentMethod === 'transfer'. Ignored otherwise. */
  paymentBank?: string | null;
  /** Cobrar ahora vs cobrar al retirar. Defaults to `paid` server-side. */
  paymentStatus?: 'paid' | 'unpaid';
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
