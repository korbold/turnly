import api from './client';
import type { Reservation, AvailableSlot } from '@/types/reservation';
import type { PaginatedResponse } from '@/types/api';

export async function getReservations(params?: {
  date?: string;
  status?: string;
  service_id?: string;
  per_page?: number;
}): Promise<PaginatedResponse<Reservation>> {
  const response = await api.get('/reservations', { params });
  return response.data;
}

export async function getReservation(id: string): Promise<Reservation> {
  const response = await api.get(`/reservations/${id}`);
  return response.data.data;
}

export async function createReservation(data: {
  vehicle_id: string;
  service_id: string;
  scheduled_at: string;
  assigned_to?: string;
  notes?: string;
}): Promise<Reservation> {
  const response = await api.post('/reservations', data);
  return response.data.data;
}

export async function confirmReservation(id: string): Promise<void> {
  await api.patch(`/reservations/${id}/confirm`);
}

export async function startReservation(id: string): Promise<void> {
  await api.patch(`/reservations/${id}/start`);
}

export async function completeReservation(id: string): Promise<void> {
  await api.patch(`/reservations/${id}/complete`);
}

export async function cancelReservation(id: string, reason?: string): Promise<void> {
  await api.patch(`/reservations/${id}/cancel`, { reason });
}

export async function getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]> {
  const response = await api.get('/reservations/available-slots', {
    params: { date, service_id: serviceId },
  });
  return response.data.data;
}
