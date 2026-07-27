export type InvoiceStatus = 'pendiente' | 'enviada' | 'autorizada' | 'rechazada';

export interface Invoice {
  /** Billing-service invoice id — used for RIDE (PDF) and XML downloads. */
  id: string;
  secuencial: string | null;
  claveAcceso: string | null;
  numeroAutorizacion: string | null;
  invoiceStatus: InvoiceStatus;
  fechaEmision: string | null;
  fechaAutorizacion: string | null;
  importeTotal: number;
  razonSocialComprador: string | null;
  identificacionComprador: string | null;
}

export interface InvoiceFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: InvoiceStatus;
  page?: number;
}
