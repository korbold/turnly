import type { Invoice, InvoiceFilters } from '../entities/invoice';
import type { PaginatedResult } from '../../shared/types/api';

export interface InvoiceRepository {
  getAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>>;
  emit(serviceLogId: string): Promise<void>;
}
