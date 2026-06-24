import type { ServiceLog, ServiceLogItem, DailySummary } from '@/domain/entities/service-log';

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
    createdBy: raw.created_by as string,
    startedAt: new Date(raw.started_at as string),
    finishedAt: raw.finished_at ? new Date(raw.finished_at as string) : null,
    priceCharged:
      typeof raw.price_charged === 'string'
        ? parseFloat(raw.price_charged)
        : (raw.price_charged as number),
    paymentMethod: (raw.payment_method as ServiceLog['paymentMethod']) ?? null,
    paymentBank: (raw.payment_bank as string | null) ?? null,
    paymentStatus: ((raw.payment_status as 'paid' | 'unpaid' | null) ?? 'paid') as ServiceLog['paymentStatus'],
    paidAt: raw.paid_at ? new Date(raw.paid_at as string) : null,
    invoiced: Boolean(raw.invoiced ?? false),
    invoicedAt: raw.invoiced_at ? new Date(raw.invoiced_at as string) : null,
    items: Array.isArray(raw.items)
      ? (raw.items as Record<string, unknown>[]).map(mapServiceLogItem)
      : undefined,
    servicesSummary: raw.services_summary
      ? {
          count: Number((raw.services_summary as Record<string, unknown>).count ?? 0),
          labels: ((raw.services_summary as Record<string, unknown>).labels as string[]) ?? [],
        }
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
    lineTotal: Number(raw.line_total ?? 0),
    sortOrder: Number(raw.sort_order ?? 0),
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
  };
}
