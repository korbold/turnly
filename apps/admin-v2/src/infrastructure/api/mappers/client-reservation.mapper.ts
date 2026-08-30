import type { ClientReservation } from '@/domain/entities/client-reservation';
import type { ReservationStatus } from '@/domain/entities/reservation';

export function mapClientReservation(raw: Record<string, unknown>): ClientReservation {
  const tenant = raw.tenant as Record<string, unknown> | undefined;
  const service = raw.service as Record<string, unknown> | undefined;
  const resource = raw.client_resource as Record<string, unknown> | undefined;
  const rawItems = (raw.items as Array<Record<string, unknown>> | undefined) ?? [];

  const items = rawItems.map((it) => ({
    id: String(it.id),
    label: String(it.label ?? ''),
    qty: Number(it.qty ?? 1),
    lineTotal: Number(it.line_total ?? 0),
  }));

  // Multi-service bookings carry items[]; the older single-service shape
  // only has the service price.
  const total = items.length
    ? items.reduce((acc, it) => acc + it.lineTotal, 0)
    : Number(service?.price ?? 0);

  return {
    id: String(raw.id),
    scheduledAt: new Date(raw.scheduled_at as string),
    estimatedEnd: raw.estimated_end ? new Date(raw.estimated_end as string) : null,
    status: raw.status as ReservationStatus,
    notes: (raw.notes as string | null) ?? null,
    cancelledAt: raw.cancelled_at ? new Date(raw.cancelled_at as string) : null,
    cancelReason: (raw.cancel_reason as string | null) ?? null,
    rescheduledAt: raw.client_rescheduled_at
      ? new Date(raw.client_rescheduled_at as string)
      : null,
    business: tenant
      ? {
          name: String(tenant.name ?? ''),
          slug: String(tenant.slug ?? ''),
          cancellationHours: Number(tenant.cancellation_hours ?? 1),
          whatsapp: (tenant.whatsapp as string | null) ?? null,
          phone: (tenant.phone as string | null) ?? null,
          country: (tenant.country as string | null) ?? null,
        }
      : null,
    service: service
      ? { name: String(service.name ?? ''), price: Number(service.price ?? 0) }
      : null,
    resourceLabel: (resource?.label as string | null) ?? null,
    items,
    total,
    paymentStatus: ((raw.payment_status as 'unpaid' | 'paid' | null) ?? 'unpaid'),
  };
}
