import api from './client';
import type { Service } from '@/types/service';
import type { PaginatedResponse } from '@/types/api';

export async function getServices(params?: { per_page?: number }): Promise<PaginatedResponse<Service>> {
  const response = await api.get('/services', { params: { ...params, per_page: params?.per_page ?? 50 } });
  return response.data;
}

export async function createService(data: {
  name: string;
  price: number;
  duration_minutes: number;
  description?: string;
}): Promise<Service> {
  const response = await api.post('/services', data);
  return response.data.data;
}

export async function updateService(id: string, data: Partial<{
  name: string;
  price: number;
  duration_minutes: number;
  description: string;
  is_active: boolean;
  sort_order: number;
}>): Promise<Service> {
  const response = await api.put(`/services/${id}`, data);
  return response.data.data;
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/services/${id}`);
}
