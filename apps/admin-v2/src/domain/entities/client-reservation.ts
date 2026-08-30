import type { ReservationStatus } from '@/domain/entities/reservation';

/**
 * A reservation as the *customer* sees it, across every business they
 * booked with. Deliberately narrower than the staff-facing Reservation:
 * the portal never shows internal ids, assignment or fiscal plumbing —
 * it shows where, when, what and how much.
 */
export interface ClientReservation {
  id: string;
  scheduledAt: Date;
  estimatedEnd: Date | null;
  status: ReservationStatus;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  /** Set once the customer used their single self-reschedule. */
  rescheduledAt: Date | null;
  business: {
    name: string;
    slug: string;
    cancellationHours: number;
    /** Con qué escribirle al negocio desde el detalle de la cita. */
    whatsapp: string | null;
    phone: string | null;
    country: string | null;
  } | null;
  service: { name: string; price: number } | null;
  resourceLabel: string | null;
  items: { id: string; label: string; qty: number; lineTotal: number }[];
  total: number;
  paymentStatus: 'unpaid' | 'paid';
}

const UPCOMING: ReservationStatus[] = ['pending', 'confirmed', 'checked_in', 'in_progress'];

export function isUpcoming(r: ClientReservation): boolean {
  return UPCOMING.includes(r.status);
}

/**
 * Cancelling is blocked inside the business's cooldown window — the same
 * rule the API enforces. Checking it here keeps the button from
 * promising something the server will refuse.
 */
export function canCancel(r: ClientReservation, now: Date = new Date()): boolean {
  if (!isUpcoming(r) || r.status === 'in_progress') return false;
  const hours = r.business?.cancellationHours ?? 1;
  return r.scheduledAt.getTime() - now.getTime() > hours * 3600_000;
}

export const CANCEL_REASONS = [
  'Ya no lo necesito',
  'Encontré otro horario',
  'Surgió un imprevisto',
  'Me equivoqué al reservar',
  'Otro motivo',
] as const;
