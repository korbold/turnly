import api from './client';
import type { ServiceLog, DailySummary } from '@/types/service-log';
import type { PaginatedResponse } from '@/types/api';

export async function getServiceLogs(params?: {
  date?: string;
  per_page?: number;
}): Promise<PaginatedResponse<ServiceLog>> {
  const response = await api.get('/service-logs', { params });
  return response.data;
}

export async function createServiceLog(data: {
  client_resource_id: string;
  service_id: string;
  attended_by: string;
  price_charged: number;
  payment_method: string;
  reservation_id?: string;
  notes?: string;
}): Promise<ServiceLog> {
  const response = await api.post('/service-logs', data);
  return response.data.data;
}

export async function updateServiceLog(id: string, data: {
  service_id?: string;
  attended_by?: string;
  price_charged?: number;
  payment_method?: string;
  notes?: string;
}): Promise<ServiceLog> {
  const response = await api.patch(`/service-logs/${id}`, data);
  return response.data.data;
}

export async function deleteServiceLog(id: string): Promise<void> {
  await api.delete(`/service-logs/${id}`);
}

export async function completeServiceLog(id: string): Promise<void> {
  await api.patch(`/service-logs/${id}/complete`);
}

export async function getDailySummary(date?: string): Promise<DailySummary> {
  const params = date ? { date } : {};
  const response = await api.get('/service-logs/summary', { params });
  return response.data.data;
}
