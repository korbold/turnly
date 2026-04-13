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

export interface RangeReport {
  from: string;
  to: string;
  total_services: number;
  total_revenue: number;
  services_count: number;
  reservations_count: number;
  reservations_total: number;
  reservations_cancelled: number;
  by_payment_method: { cash: number; card: number; transfer: number };
  daily: { date: string; services: number; reservations: number; revenue: number }[];
}

export async function getRangeReport(from: string, to: string): Promise<RangeReport> {
  const response = await api.get('/reports/range', { params: { from, to } });
  return response.data.data;
}

export async function getWeeklyReport(week?: string) {
  const params = week ? { week } : {};
  const response = await api.get('/reports/weekly', { params });
  return response.data.data;
}

export async function getMonthlyReport(month?: string) {
  const params = month ? { month } : {};
  const response = await api.get('/reports/monthly', { params });
  return response.data.data;
}
