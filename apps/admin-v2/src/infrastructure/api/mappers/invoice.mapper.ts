import type { Invoice } from '@/domain/entities/invoice';

export function mapInvoice(raw: Record<string, unknown>): Invoice {
  const clientResource = raw.client_resource as Record<string, unknown> | undefined;
  const service = raw.service as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    serviceLogId: raw.id as string,
    externalId: (raw.invoice_external_id as string) ?? '',
    claveAcceso: (raw.invoice_clave_acceso as string | null) ?? null,
    numeroAutorizacion: (raw.invoice_numero_autorizacion as string | null) ?? null,
    invoiceStatus: raw.invoice_status as Invoice['invoiceStatus'],
    invoiceError: (raw.invoice_error as string | null) ?? null,
    logDate: raw.log_date as string,
    invoicedAt: raw.invoiced_at ? new Date(raw.invoiced_at as string) : null,
    priceCharged:
      typeof raw.price_charged === 'string'
        ? parseFloat(raw.price_charged)
        : (raw.price_charged as number),
    paymentMethod: (raw.payment_method as string | null) ?? null,
    clientName: clientResource?.client
      ? ((clientResource.client as Record<string, unknown>).name as string)
      : null,
    clientPlate: (clientResource?.plate as string | null) ?? null,
    serviceName: service ? (service.name as string) : null,
  };
}
