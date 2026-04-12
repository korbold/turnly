import api from './client';

export interface DailyReport {
  date: string;
  washes: {
    total: number;
    completed: number;
    in_progress: number;
    revenue: number;
    by_payment_method: {
      cash: number;
      card: number;
      transfer: number;
    };
  };
  reservations: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
}

export async function getDailyReport(date?: string): Promise<DailyReport> {
  const params = date ? { date } : {};
  const response = await api.get('/reports/daily', { params });
  return response.data.data;
}
