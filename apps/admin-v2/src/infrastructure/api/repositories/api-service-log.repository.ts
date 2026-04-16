import type {
  ServiceLogRepository,
  CreateServiceLogData,
  UpdateServiceLogData,
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

    const { data } = await api.get('/service-logs', { params });
    return mapPaginatedResponse(data, mapServiceLog);
  }

  async getById(id: string): Promise<ServiceLog> {
    const { data } = await api.get(`/service-logs/${id}`);
    return mapServiceLog(data.data ?? data);
  }

  async create(data: CreateServiceLogData): Promise<ServiceLog> {
    const { data: res } = await api.post('/service-logs', {
      client_resource_id: data.clientResourceId,
      service_id: data.serviceId,
      attended_by: data.attendedBy,
      price_charged: data.priceCharged,
      payment_method: data.paymentMethod,
      notes: data.notes,
    });
    return mapServiceLog(res.data ?? res);
  }

  async update(id: string, data: UpdateServiceLogData): Promise<ServiceLog> {
    const body: Record<string, unknown> = {};
    if (data.serviceId !== undefined) body.service_id = data.serviceId;
    if (data.attendedBy !== undefined) body.attended_by = data.attendedBy;
    if (data.priceCharged !== undefined) body.price_charged = data.priceCharged;
    if (data.paymentMethod !== undefined) body.payment_method = data.paymentMethod;
    if (data.notes !== undefined) body.notes = data.notes;

    const { data: res } = await api.patch(`/service-logs/${id}`, body);
    return mapServiceLog(res.data ?? res);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/service-logs/${id}`);
  }

  async complete(id: string): Promise<ServiceLog> {
    const { data } = await api.patch(`/service-logs/${id}/complete`);
    return mapServiceLog(data.data ?? data);
  }

  async getSummary(date: string): Promise<DailySummary> {
    const { data } = await api.get('/service-logs/summary', { params: { date } });
    return mapDailySummary(data.data ?? data);
  }
}
