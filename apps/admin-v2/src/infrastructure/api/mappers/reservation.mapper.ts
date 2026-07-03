import type {
  Reservation,
  AvailableSlot,
  ReservationItem,
  ReservationItemChange,
  BillingSnapshot,
  ClientBillingProfile,
} from '@/domain/entities/reservation';

export function mapReservation(raw: Record<string, unknown>): Reservation {
  const clientResource = raw.client_resource as Record<string, unknown> | undefined;
  const service = raw.service as Record<string, unknown> | undefined;
  const client = raw.client as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    clientId: raw.client_id as string,
    clientResourceId: raw.client_resource_id as string,
    businessResourceId: (raw.business_resource_id as string | null) ?? null,
    serviceId: raw.service_id as string,
    serviceVariantId: (raw.service_variant_id as string | null) ?? null,
    assignedTo: (raw.assigned_to as string) ?? null,
    scheduledAt: new Date(raw.scheduled_at as string),
    estimatedEnd: new Date(raw.estimated_end as string),
    status: raw.status as Reservation['status'],
    notes: (raw.notes as string) ?? null,
    cancelledAt: raw.cancelled_at ? new Date(raw.cancelled_at as string) : null,
    cancelReason: (raw.cancel_reason as string) ?? null,
    createdBy: raw.created_by as string,
    createdAt: new Date(raw.created_at as string),
    checkedInAt: raw.checked_in_at ? new Date(raw.checked_in_at as string) : null,
    billingSnapshot: mapBillingSnapshot(raw.billing_snapshot),
    paymentStatus: ((raw.payment_status as 'unpaid' | 'paid' | null) ?? 'unpaid') as Reservation['paymentStatus'],
    paymentMethod: ((raw.payment_method as 'transfer' | 'card' | 'cash' | null) ?? null) as Reservation['paymentMethod'],
    paidAt: raw.paid_at ? new Date(raw.paid_at as string) : null,
    paymentReference: (raw.payment_reference as string | null) ?? null,
    paymentBank: (raw.payment_bank as string | null) ?? null,
    invoiced: (raw.invoiced as boolean) ?? false,
    invoicedAt: raw.invoiced_at ? new Date(raw.invoiced_at as string) : null,
    invoiceExternalId: (raw.invoice_external_id as string | null) ?? null,
    invoiceStatus: (raw.invoice_status as string | null) ?? null,
    invoiceClaveAcceso: (raw.invoice_clave_acceso as string | null) ?? null,
    invoiceNumeroAutorizacion: (raw.invoice_numero_autorizacion as string | null) ?? null,
    invoiceError: (raw.invoice_error as string | null) ?? null,
    clientResource: clientResource
      ? {
          label: (clientResource.label as string) ?? null,
          data: (clientResource.data as Record<string, unknown>) ?? null,
          plate: (clientResource.plate as string) ?? null,
          brand: (clientResource.brand as string) ?? null,
          model: (clientResource.model as string) ?? null,
          color: (clientResource.color as string) ?? null,
          type: (clientResource.type as string | null) ?? null,
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
          defaultBillingProfile: mapClientBillingProfile(client.default_billing_profile),
        }
      : undefined,
    servicesSummary: raw.services_summary
      ? {
          count: Number((raw.services_summary as Record<string, unknown>).count ?? 0),
          labels: ((raw.services_summary as Record<string, unknown>).labels as string[]) ?? [],
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

function mapClientBillingProfile(raw: unknown): ClientBillingProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    docType: o.doc_type as ClientBillingProfile['docType'],
    docNumber: (o.doc_number as string) ?? '',
    legalName: (o.legal_name as string) ?? '',
    email: (o.email as string | null) ?? null,
    address: (o.address as string | null) ?? null,
    phone: (o.phone as string | null) ?? null,
  };
}

function mapBillingSnapshot(raw: unknown): BillingSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    docType: o.doc_type as BillingSnapshot['docType'],
    docNumber: (o.doc_number as string) ?? '',
    legalName: (o.legal_name as string) ?? '',
    email: (o.email as string | null) ?? null,
    address: (o.address as string | null) ?? null,
    phone: (o.phone as string | null) ?? null,
    source: (o.source as BillingSnapshot['source']) ?? 'manual',
    capturedAt: (o.captured_at as string) ?? '',
  };
}

export function mapReservationItem(raw: Record<string, unknown>): ReservationItem {
  return {
    id: raw.id as string,
    reservationId: raw.reservation_id as string,
    itemType: raw.item_type as ReservationItem['itemType'],
    refId: raw.ref_id as string,
    serviceId: (raw.service_id as string | null | undefined) ?? null,
    label: raw.label as string,
    qty: Number(raw.qty ?? 1),
    unitPrice: Number(raw.unit_price ?? 0),
    lineTotal: Number(raw.line_total ?? 0),
    sortOrder: Number(raw.sort_order ?? 0),
    createdAt: raw.created_at ? new Date(raw.created_at as string) : undefined,
  };
}

export function mapReservationItemChange(raw: Record<string, unknown>): ReservationItemChange {
  return {
    id: raw.id as string,
    action: raw.action as ReservationItemChange['action'],
    itemType: (raw.item_type as string | null) ?? null,
    label: (raw.label as string | null) ?? null,
    oldPrice: raw.old_price === null || raw.old_price === undefined ? null : Number(raw.old_price),
    newPrice: raw.new_price === null || raw.new_price === undefined ? null : Number(raw.new_price),
    reason: (raw.reason as string | null) ?? null,
    changedBy: raw.changed_by
      ? {
          id: (raw.changed_by as { id: string }).id,
          name: (raw.changed_by as { name: string }).name,
        }
      : null,
    changedAt: new Date(raw.changed_at as string),
  };
}
