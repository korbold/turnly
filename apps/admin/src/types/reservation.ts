export type ReservationStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  client_id: string;
  client_resource_id: string;
  service_id: string;
  assigned_to: string | null;
  scheduled_at: string;
  estimated_end: string;
  status: ReservationStatus;
  notes: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string;
  created_at: string;
  client_resource?: { label: string | null; data: Record<string, unknown> | null; plate: string | null; brand: string | null; model: string | null; color: string | null };
  service?: { name: string; price: string };
  client?: { name: string; email: string };
}

export interface AvailableSlot {
  start: string;
  end: string;
  available: number;
}
