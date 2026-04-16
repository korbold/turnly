export type ReservationStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type ReservationAction = 'confirm' | 'start' | 'complete' | 'cancel';

export interface ReservationClientResource {
  label: string | null;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
}

export interface ReservationService {
  name: string;
  price: string;
}

export interface ReservationClient {
  name: string;
  email: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  clientResourceId: string;
  serviceId: string;
  assignedTo: string | null;
  scheduledAt: Date;
  estimatedEnd: Date;
  status: ReservationStatus;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: string;
  createdAt: Date;
  clientResource?: ReservationClientResource;
  service?: ReservationService;
  client?: ReservationClient;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  available: number;
}

export interface ReservationFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: ReservationStatus;
  serviceId?: string;
  page?: number;
}
