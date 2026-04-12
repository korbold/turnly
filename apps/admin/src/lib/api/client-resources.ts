import api from './client';
import type { ClientResource } from '@/types/client-resource';
import type { PaginatedResponse } from '@/types/api';

export async function getClientResources(params?: { per_page?: number }): Promise<PaginatedResponse<ClientResource>> {
  const response = await api.get('/client-resources', { params });
  return response.data;
}

export async function createClientResource(data: {
  label?: string;
  data?: Record<string, string>;
  plate?: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
}): Promise<ClientResource> {
  const response = await api.post('/client-resources', data);
  return response.data.data;
}

export async function updateClientResource(id: string, data: {
  label?: string;
  data?: Record<string, string>;
}): Promise<ClientResource> {
  const response = await api.patch(`/client-resources/${id}`, data);
  return response.data.data;
}

export async function getClientResource(id: string): Promise<ClientResource> {
  const response = await api.get(`/client-resources/${id}`);
  return response.data.data;
}

export async function getClientResourceHistory(id: string) {
  const response = await api.get(`/client-resources/${id}/history`);
  return response.data.data;
}
