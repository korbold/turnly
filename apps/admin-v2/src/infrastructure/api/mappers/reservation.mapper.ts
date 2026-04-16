import type { Reservation, AvailableSlot } from '@/domain/entities/reservation';

export function mapReservation(raw: Record<string, unknown>): Reservation {
  const clientResource = raw.client_resource as Record<string, unknown> | undefined;
  const service = raw.service as Record<string, unknown> | undefined;
  const client = raw.client as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    clientId: raw.client_id as string,
    clientResourceId: raw.client_resource_id as string,
    serviceId: raw.service_id as string,
    assignedTo: (raw.assigned_to as string) ?? null,
    scheduledAt: new Date(raw.scheduled_at as string),
    estimatedEnd: new Date(raw.estimated_end as string),
    status: raw.status as Reservation['status'],
    notes: (raw.notes as string) ?? null,
    cancelledAt: raw.cancelled_at ? new Date(raw.cancelled_at as string) : null,
    cancelReason: (raw.cancel_reason as string) ?? null,
    createdBy: raw.created_by as string,
    createdAt: new Date(raw.created_at as string),
    clientResource: clientResource
      ? {
          label: (clientResource.label as string) ?? null,
          data: (clientResource.data as Record<string, unknown>) ?? null,
          plate: (clientResource.plate as string) ?? null,
          brand: (clientResource.brand as string) ?? null,
          model: (clientResource.model as string) ?? null,
          color: (clientResource.color as string) ?? null,
        }
      : undefined,
    service: service
      ? {
          name: service.name as string,
          price: String(service.price),
        }
      : undefined,
    client: client
      ? {
          name: client.name as string,
          email: client.email as string,
        }
      : undefined,
  };
}

export function mapAvailableSlot(raw: Record<string, unknown>): AvailableSlot {
  return {
    start: new Date(raw.start as string),
    end: new Date(raw.end as string),
    available: raw.available as number,
  };
}
