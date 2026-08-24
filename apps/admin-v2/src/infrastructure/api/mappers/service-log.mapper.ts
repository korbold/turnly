import type {
  ServiceLog,
  ServiceLogItem,
  ServiceLogEvent,
  DailySummary,
  PriceChange,
} from '@/domain/entities/service-log';

export function mapServiceLog(raw: Record<string, unknown>): ServiceLog {
  const clientResource = raw.client_resource as Record<string, unknown> | undefined;
  const service = raw.service as Record<string, unknown> | undefined;
  const attendant = raw.attendant as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    clientResourceId: raw.client_resource_id as string,
    serviceId: raw.service_id as string,
    reservationId: (raw.reservation_id as string) ?? null,
    attendedBy: raw.attended_by as string,
    washedBy: (raw.washed_by as string | null) ?? null,
    driedBy: (raw.dried_by as string | null) ?? null,
    events: Array.isArray(raw.events)
      ? (raw.events as Record<string, unknown>[]).map((e) => ({
          id: e.id as string,
          event: e.event as ServiceLogEvent['event'],
          detail: (e.detail as Record<string, unknown>) ?? {},
          changedAt: new Date(e.changed_at as string),
          changedBy: (e.changed_by as { id: string; name: string } | null) ?? null,
        }))
      : undefined,
    washer: (raw.washer as { id: string; name: string } | null) ?? null,
    dryer: (raw.dryer as { id: string; name: string } | null) ?? null,
    createdBy: raw.created_by as string,
    startedAt: new Date(raw.started_at as string),
    finishedAt: raw.finished_at ? new Date(raw.finished_at as string) : null,
    priceCharged:
      typeof raw.price_charged === 'string'
        ? parseFloat(raw.price_charged)
        : (raw.price_charged as number),
    paymentMethod: (raw.payment_method as ServiceLog['paymentMethod']) ?? null,
    paymentBank: (raw.payment_bank as string | null) ?? null,
    paymentStatus: ((raw.payment_status as 'paid' | 'unpaid' | 'partial' | null) ?? 'paid') as ServiceLog['paymentStatus'],
    leftOwing: Boolean(raw.left_owing ?? false),
    otherDebt: Number(raw.other_debt ?? 0),
    amountPaid: Number(raw.amount_paid ?? 0),
    // Sin el campo (respuesta vieja en caché), lo que falta es todo el precio
    // si no está pagado: nunca mostrar "$0 pendiente" por un dato ausente.
    amountDue: raw.amount_due !== undefined
      ? Number(raw.amount_due)
      : (raw.payment_status === 'paid' ? 0 : Number(raw.price_charged ?? 0)),
    paidAt: raw.paid_at ? new Date(raw.paid_at as string) : null,
    invoiced: Boolean(raw.invoiced ?? false),
    invoicedAt: raw.invoiced_at ? new Date(raw.invoiced_at as string) : null,
    invoiceStatus: (raw.invoice_status as ServiceLog['invoiceStatus']) ?? null,
    invoiceExternalId: (raw.invoice_external_id as string | null) ?? null,
    invoiceClaveAcceso: (raw.invoice_clave_acceso as string | null) ?? null,
    invoiceNumeroAutorizacion: (raw.invoice_numero_autorizacion as string | null) ?? null,
    invoiceError: (raw.invoice_error as string | null) ?? null,
    items: Array.isArray(raw.items)
      ? (raw.items as Record<string, unknown>[]).map(mapServiceLogItem)
      : undefined,
    servicesSummary: raw.services_summary
      ? {
          count: Number((raw.services_summary as Record<string, unknown>).count ?? 0),
          labels: ((raw.services_summary as Record<string, unknown>).labels as string[]) ?? [],
        }
      : undefined,
    // `null` explícito y `undefined` no son lo mismo acá: null es "el backend
    // miró y esta fila cobró lo del catálogo"; undefined es "no lo mandó",
    // como en el detalle. Sólo el primero apaga la marca con certeza.
    priceChange: 'price_change' in raw
      ? mapPriceChange(raw.price_change as Record<string, unknown> | null)
      : undefined,
    status: raw.status as ServiceLog['status'],
    notes: (raw.notes as string) ?? null,
    logDate: raw.log_date as string,
    createdAt: new Date(raw.created_at as string),
    clientResource: clientResource
      ? {
          label: (clientResource.label as string) ?? null,
          plate: (clientResource.plate as string) ?? null,
          brand: (clientResource.brand as string) ?? null,
          client: clientResource.client
            ? {
                name: (clientResource.client as Record<string, unknown>).name as string,
                email: (clientResource.client as Record<string, unknown>).email as
                  | string
                  | undefined,
              }
            : undefined,
        }
      : undefined,
    service: service ? { name: service.name as string } : undefined,
    attendant: attendant ? { name: attendant.name as string } : undefined,
  };
}

function mapServiceLogItem(raw: Record<string, unknown>): ServiceLogItem {
  return {
    id: raw.id as string,
    itemType: (raw.item_type as ServiceLogItem['itemType']) ?? 'service_variant',
    refId: raw.ref_id as string,
    // service_id is exposed by the API alongside ref_id so variant items
    // carry the parent service UUID (ref_id holds the variant UUID for those).
    // Falls back to ref_id for plain service items (where ref_id IS the service_id).
    serviceId: (raw.service_id as string | undefined) ?? (raw.ref_id as string),
    label: raw.label as string,
    qty: Number(raw.qty ?? 1),
    unitPrice: Number(raw.unit_price ?? 0),
    catalogPrice: raw.catalog_price == null ? null : Number(raw.catalog_price),
    lineTotal: Number(raw.line_total ?? 0),
    sortOrder: Number(raw.sort_order ?? 0),
  };
}

function mapPriceChange(raw: Record<string, unknown> | null): PriceChange | null {
  if (!raw) return null;

  return {
    catalog: Number(raw.catalog ?? 0),
    charged: Number(raw.charged ?? 0),
    difference: Number(raw.difference ?? 0),
    reasonCode: (raw.reason_code as string | null) ?? null,
    reasonLabel: (raw.reason_label as string) ?? 'Sin motivo',
    note: (raw.note as string | null) ?? null,
    changes: Number(raw.changes ?? 1),
    by: (raw.by as string | null) ?? null,
    at: raw.at ? new Date(raw.at as string) : null,
  };
}

export function mapDailySummary(raw: Record<string, unknown>): DailySummary {
  return {
    totalWashes: (raw.total_washes ?? raw.totalWashes) as number,
    totalRevenue: (raw.total_revenue ?? raw.totalRevenue) as number,
    byPaymentMethod: (raw.by_payment_method ?? raw.byPaymentMethod ?? {}) as Record<
      string,
      { count: number; total: number }
    >,
    byStatus: (raw.by_status ?? raw.byStatus ?? {}) as Record<string, number>,
    collected: (raw.collected ?? { count: 0, total: 0 }) as { count: number; total: number },
    unpaid: (raw.unpaid ?? { count: 0, total: 0 }) as { count: number; total: number },
  };
}
