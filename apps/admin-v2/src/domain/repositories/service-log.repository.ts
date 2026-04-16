import type { ServiceLog, ServiceLogFilters, DailySummary, PaymentMethod } from '../entities/service-log';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateServiceLogData {
  clientResourceId: string;
  serviceId: string;
  attendedBy: string;
  priceCharged: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface UpdateServiceLogData {
  serviceId?: string;
  attendedBy?: string;
  priceCharged?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface ServiceLogRepository {
  getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>>;
  getById(id: string): Promise<ServiceLog>;
  create(data: CreateServiceLogData): Promise<ServiceLog>;
  update(id: string, data: UpdateServiceLogData): Promise<ServiceLog>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<ServiceLog>;
  getSummary(date: string): Promise<DailySummary>;
}
