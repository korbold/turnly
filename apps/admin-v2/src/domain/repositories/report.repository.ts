export interface ReportStats {
  totalServices: number;
  /** Everything registered in the range, collected or not. */
  totalRevenue: number;
  /** Money actually taken — what the payment-method breakdown adds up to. */
  collectedRevenue: number;
  unpaidRevenue: number;
  unpaidCount: number;
  totalReservations: number;
  averageDailyRevenue: number;
}

export interface DailyBreakdown {
  date: string;
  services: number;
  revenue: number;
  collected: number;
  unpaid: number;
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
  /** Banks with activity in the range, before the bank filter narrows it. */
  availableBanks: string[];
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
