import type { Invoice } from '@/domain/entities/invoice';

/**
 * Maps a row from the billing service invoice list
 * (GET /billing/invoices → proxied to the billing microservice).
 */
export function mapInvoice(raw: Record<string, unknown>): Invoice {
  const total = raw.importe_total;

  return {
    id: raw.id as string,
    secuencial: (raw.secuencial as string | null) ?? null,
    claveAcceso: (raw.clave_acceso as string | null) ?? null,
    numeroAutorizacion: (raw.numero_autorizacion as string | null) ?? null,
    invoiceStatus: raw.estado as Invoice['invoiceStatus'],
    fechaEmision: (raw.fecha_emision as string | null) ?? null,
    fechaAutorizacion: (raw.fecha_autorizacion as string | null) ?? null,
    importeTotal: typeof total === 'string' ? parseFloat(total) : ((total as number) ?? 0),
    razonSocialComprador: (raw.razon_social_comprador as string | null) ?? null,
    identificacionComprador: (raw.identificacion_comprador as string | null) ?? null,
  };
}
