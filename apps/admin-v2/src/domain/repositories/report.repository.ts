export interface ReportStats {
  totalServices: number;
  totalRevenue: number;
  totalReservations: number;
  averageDailyRevenue: number;
}

export interface DailyBreakdown {
  date: string;
  services: number;
  revenue: number;
  byCash: number;
  byCard: number;
  byTransfer: number;
  reservations: number;
}

export interface RangeReport {
  stats: ReportStats;
  dailyBreakdown: DailyBreakdown[];
  byPaymentMethod: Record<string, { count: number; total: number }>;
  byBank: Record<string, { count: number; total: number }>;
  filters: {
    paymentMethod: 'cash' | 'card' | 'transfer' | null;
    paymentBank: string | null;
  };
}

export interface RangeReportFilters {
  paymentMethod?: 'cash' | 'card' | 'transfer' | null;
  paymentBank?: string | null;
}

export interface ReportRepository {
  getDaily(date: string): Promise<RangeReport>;
  getRange(from: string, to: string, filters?: RangeReportFilters): Promise<RangeReport>;
  getWeekly(week: string): Promise<RangeReport>;
  getMonthly(month: string): Promise<RangeReport>;
}
