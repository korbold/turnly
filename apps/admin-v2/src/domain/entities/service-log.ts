export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type ServiceLogStatus = 'in_progress' | 'completed';

export interface ServiceLogClientResource {
  label?: string | null;
  plate: string | null;
  brand: string | null;
  client?: { name: string; email?: string };
}

export interface ServiceLogService {
  name: string;
}

export interface ServiceLogAttendant {
  name: string;
}

export interface ServiceLog {
  id: string;
  clientResourceId: string;
  serviceId: string;
  reservationId: string | null;
  attendedBy: string;
  createdBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  priceCharged: number;
  paymentMethod: PaymentMethod;
  status: ServiceLogStatus;
  notes: string | null;
  logDate: string;
  createdAt: Date;
  clientResource?: ServiceLogClientResource;
  service?: ServiceLogService;
  attendant?: ServiceLogAttendant;
}

export interface DailySummary {
  totalWashes: number;
  totalRevenue: number;
  byPaymentMethod: Record<string, { count: number; total: number }>;
  byStatus: Record<string, number>;
}

export interface ServiceLogFilters {
  date?: string;
  page?: number;
}
