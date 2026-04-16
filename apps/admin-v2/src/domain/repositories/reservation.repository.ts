import type { Reservation, ReservationFilters, ReservationAction, AvailableSlot } from '../entities/reservation';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateReservationData {
  clientResourceId: string;
  serviceId: string;
  scheduledAt: string;
  assignedTo?: string;
  notes?: string;
}

export interface ReservationRepository {
  getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>>;
  getById(id: string): Promise<Reservation>;
  create(data: CreateReservationData): Promise<Reservation>;
  cancel(id: string, reason: string): Promise<Reservation>;
  transition(id: string, action: ReservationAction): Promise<Reservation>;
  getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]>;
}
