export type InvoiceStatus = 'pendiente' | 'enviada' | 'autorizada' | 'rechazada';

export interface Invoice {
  id: string;
  serviceLogId: string;
  externalId: string;
  claveAcceso: string | null;
  numeroAutorizacion: string | null;
  invoiceStatus: InvoiceStatus;
  invoiceError: string | null;
  logDate: string;
  invoicedAt: Date | null;
  priceCharged: number;
  paymentMethod: string | null;
  clientName: string | null;
  clientPlate: string | null;
  serviceName: string | null;
}

export interface InvoiceFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: InvoiceStatus;
  page?: number;
}
