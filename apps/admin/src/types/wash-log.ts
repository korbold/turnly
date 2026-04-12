export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface WashLog {
  id: string;
  vehicle_id: string;
  service_id: string;
  reservation_id: string | null;
  attended_by: string;
  created_by: string;
  started_at: string;
  finished_at: string | null;
  price_charged: string;
  payment_method: PaymentMethod;
  status: 'in_progress' | 'completed';
  notes: string | null;
  log_date: string;
  created_at: string;
  vehicle?: { plate: string; brand: string | null };
  service?: { name: string };
  attendant?: { name: string };
}

export interface DailySummary {
  total_washes: number;
  total_revenue: number;
  by_payment_method: Record<string, { count: number; total: number }>;
  by_status: Record<string, number>;
}
