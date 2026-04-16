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
}

export interface ReportRepository {
  getDaily(date: string): Promise<RangeReport>;
  getRange(from: string, to: string): Promise<RangeReport>;
  getWeekly(week: string): Promise<RangeReport>;
  getMonthly(month: string): Promise<RangeReport>;
}
