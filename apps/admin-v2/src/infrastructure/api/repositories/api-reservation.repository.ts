import type { ReservationRepository, CreateReservationData } from '@/domain/repositories/reservation.repository';
import type { Reservation, ReservationFilters, ReservationAction, AvailableSlot } from '@/domain/entities/reservation';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapReservation, mapAvailableSlot } from '../mappers/reservation.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiReservationRepository implements ReservationRepository {
  async getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>> {
    const params: Record<string, unknown> = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.serviceId) params.service_id = filters.serviceId;
    if (filters.page) params.page = filters.page;

    const { data } = await api.get('/reservations', { params });
    return mapPaginatedResponse(data, mapReservation);
  }

  async getById(id: string): Promise<Reservation> {
    const { data } = await api.get(`/reservations/${id}`);
    return mapReservation(data.data ?? data);
  }

  async create(data: CreateReservationData): Promise<Reservation> {
    const { data: res } = await api.post('/reservations', {
      client_resource_id: data.clientResourceId,
      service_id: data.serviceId,
      scheduled_at: data.scheduledAt,
      assigned_to: data.assignedTo,
      notes: data.notes,
    });
    return mapReservation(res.data ?? res);
  }

  async cancel(id: string, reason: string): Promise<Reservation> {
    const { data } = await api.patch(`/reservations/${id}/cancel`, { cancel_reason: reason });
    return mapReservation(data.data ?? data);
  }

  async transition(id: string, action: ReservationAction): Promise<Reservation> {
    const { data } = await api.patch(`/reservations/${id}/${action}`);
    return mapReservation(data.data ?? data);
  }

  async getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]> {
    const { data } = await api.get('/reservations/available-slots', {
      params: { date, service_id: serviceId },
    });
    const slots = data.data ?? data;
    return (slots as Record<string, unknown>[]).map(mapAvailableSlot);
  }
}
