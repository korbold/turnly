import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';
import type { Invoice, InvoiceFilters } from '@/domain/entities/invoice';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapInvoice } from '../mappers/invoice.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiInvoiceRepository implements InvoiceRepository {
  async getAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>> {
    const params: Record<string, unknown> = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.page) params.page = filters.page;

    const { data: res } = await api.get('/billing/invoices', { params });
    return mapPaginatedResponse(res, mapInvoice);
  }

  async emit(serviceLogId: string): Promise<void> {
    await api.post(`/service-logs/${serviceLogId}/invoice`);
  }
}
