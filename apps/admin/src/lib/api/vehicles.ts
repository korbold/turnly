import api from './client';
import type { Vehicle } from '@/types/vehicle';
import type { PaginatedResponse } from '@/types/api';

export async function getVehicles(params?: { per_page?: number }): Promise<PaginatedResponse<Vehicle>> {
  const response = await api.get('/vehicles', { params });
  return response.data;
}

export async function createVehicle(data: {
  plate: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
}): Promise<Vehicle> {
  const response = await api.post('/vehicles', data);
  return response.data.data;
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const response = await api.get(`/vehicles/${id}`);
  return response.data.data;
}

export async function getVehicleHistory(id: string) {
  const response = await api.get(`/vehicles/${id}/history`);
  return response.data.data;
}
