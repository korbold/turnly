import type {
  ServiceLogRepository,
  CreateServiceLogData,
  UpdateServiceLogData,
  RecordPaymentData,
} from '@/domain/repositories/service-log.repository';
import type { ServiceLog, ServiceLogFilters, DailySummary } from '@/domain/entities/service-log';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapServiceLog, mapDailySummary } from '../mappers/service-log.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiServiceLogRepository implements ServiceLogRepository {
  async getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>> {
    const params: Record<string, unknown> = {};
    if (filters.date) params.date = filters.date;
    if (filters.page) params.page = filters.page;

    const { data: res } = await api.get('/service-logs', { params });
    return mapPaginatedResponse(res, mapServiceLog);
  }

  async getById(id: string): Promise<ServiceLog> {
    const { data: res } = await api.get(`/service-logs/${id}`);
    return mapServiceLog(res.data);
  }

  async create(data: CreateServiceLogData): Promise<ServiceLog> {
    const body: Record<string, unknown> = {
      client_resource_id: data.clientResourceId,
      attended_by: data.attendedBy,
      payment_method: data.paymentMethod,
      payment_bank: data.paymentBank ?? null,
      payment_status: data.paymentStatus ?? 'paid',
      notes: data.notes,
    };
    if (data.items && data.items.length > 0) {
      body.items = data.items.map((it) => ({
        service_id: it.serviceId,
        variant_id: it.variantId ?? null,
        label: it.label,
        qty: it.qty,
        unit_price: it.unitPrice,
      }));
      // Backend derives service_id + price_charged from items[0] +
      // sum; we still echo them so older request paths can read.
      body.service_id = data.items[0].serviceId;
      body.price_charged = data.items.reduce(
        (acc, it) => acc + it.unitPrice * it.qty,
        0,
      );
    } else {
      body.service_id = data.serviceId;
      body.price_charged = data.priceCharged;
    }
    const { data: res } = await api.post('/service-logs', body);
    return mapServiceLog(res.data);
  }

  async recordPayment(id: string, data: RecordPaymentData): Promise<ServiceLog> {
    const { data: res } = await api.post(`/service-logs/${id}/payment`, {
      method: data.method,
      bank: data.bank ?? null,
      reference: data.reference ?? null,
    });
    return mapServiceLog(res.data);
  }

  async update(id: string, data: UpdateServiceLogData): Promise<ServiceLog> {
    const body: Record<string, unknown> = {};
    if (data.serviceId !== undefined) body.service_id = data.serviceId;
    if (data.attendedBy !== undefined) body.attended_by = data.attendedBy;
    if (data.priceCharged !== undefined) body.price_charged = data.priceCharged;
    if (data.paymentMethod !== undefined) body.payment_method = data.paymentMethod;
    if (data.paymentBank !== undefined) body.payment_bank = data.paymentBank;
    if (data.notes !== undefined) body.notes = data.notes;

    const { data: res } = await api.patch(`/service-logs/${id}`, body);
    return mapServiceLog(res.data);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/service-logs/${id}`);
  }

  async complete(id: string): Promise<ServiceLog> {
    const { data: res } = await api.patch(`/service-logs/${id}/complete`);
    return mapServiceLog(res.data);
  }

  async getSummary(date: string): Promise<DailySummary> {
    const { data: res } = await api.get('/service-logs/summary', { params: { date } });
    return mapDailySummary(res.data);
  }
}
