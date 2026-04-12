import api from './client';
import type { WashLog, DailySummary } from '@/types/wash-log';
import type { PaginatedResponse } from '@/types/api';

export async function getWashLogs(params?: {
  date?: string;
  per_page?: number;
}): Promise<PaginatedResponse<WashLog>> {
  const response = await api.get('/wash-logs', { params });
  return response.data;
}

export async function createWashLog(data: {
  vehicle_id: string;
  service_id: string;
  attended_by: string;
  price_charged: number;
  payment_method: string;
  reservation_id?: string;
  notes?: string;
}): Promise<WashLog> {
  const response = await api.post('/wash-logs', data);
  return response.data.data;
}

export async function completeWashLog(id: string): Promise<void> {
  await api.patch(`/wash-logs/${id}/complete`);
}

export async function getDailySummary(date?: string): Promise<DailySummary> {
  const params = date ? { date } : {};
  const response = await api.get('/wash-logs/summary', { params });
  return response.data.data;
}
