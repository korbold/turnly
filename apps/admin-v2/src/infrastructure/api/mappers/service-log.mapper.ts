import type { ServiceLog, DailySummary } from '@/domain/entities/service-log';

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
    paymentMethod: raw.payment_method as ServiceLog['paymentMethod'],
    paymentBank: (raw.payment_bank as string | null) ?? null,
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
