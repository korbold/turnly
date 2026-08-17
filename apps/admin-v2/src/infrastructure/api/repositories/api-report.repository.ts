import type {
  ReportRepository,
  RangeReport,
  ReportStats,
  DailyBreakdown,
  RangeReportFilters,
} from '@/domain/repositories/report.repository';
import api from '../client';

function mapStats(raw: Record<string, unknown>): ReportStats {
  return {
    totalServices: (raw.total_services ?? raw.totalServices) as number,
    totalRevenue: (raw.total_revenue ?? raw.totalRevenue) as number,
    collectedRevenue: (raw.collected_revenue ?? raw.collectedRevenue ?? 0) as number,
    unpaidRevenue: (raw.unpaid_revenue ?? raw.unpaidRevenue ?? 0) as number,
    unpaidCount: (raw.unpaid_count ?? raw.unpaidCount ?? 0) as number,
    totalReservations: (raw.total_reservations ?? raw.totalReservations) as number,
    averageDailyRevenue: (raw.average_daily_revenue ?? raw.averageDailyRevenue) as number,
  };
}

function mapDailyBreakdown(raw: Record<string, unknown>): DailyBreakdown {
  return {
    date: raw.date as string,
    services: raw.services as number,
    revenue: raw.revenue as number,
    collected: (raw.collected ?? raw.revenue ?? 0) as number,
    unpaid: (raw.unpaid ?? 0) as number,
    byCash: (raw.by_cash ?? raw.byCash) as number,
    byCard: (raw.by_card ?? raw.byCard) as number,
    byTransfer: (raw.by_transfer ?? raw.byTransfer) as number,
    reservations: raw.reservations as number,
  };
}

function mapRangeReport(raw: Record<string, unknown>): RangeReport {
  const filters = (raw.filters ?? {}) as Record<string, unknown>;
  return {
    stats: mapStats((raw.stats ?? {}) as Record<string, unknown>),
    dailyBreakdown: (((raw.daily_breakdown ?? raw.dailyBreakdown) as Record<string, unknown>[]) ?? []).map(
      mapDailyBreakdown,
    ),
    byPaymentMethod: (raw.by_payment_method ?? raw.byPaymentMethod ?? {}) as Record<
      string,
      { count: number; total: number }
    >,
    byBank: (raw.by_bank ?? raw.byBank ?? {}) as Record<
      string,
      { count: number; total: number }
    >,
    filters: {
      paymentMethod: (filters.payment_method ?? filters.paymentMethod ?? null) as RangeReport['filters']['paymentMethod'],
      paymentBank: (filters.payment_bank ?? filters.paymentBank ?? null) as string | null,
    },
  };
}

export class ApiReportRepository implements ReportRepository {
  async getDaily(date: string): Promise<RangeReport> {
    const { data: res } = await api.get('/reports/daily', { params: { date } });
    return mapRangeReport(res.data);
  }

  async getRange(from: string, to: string, filters?: RangeReportFilters): Promise<RangeReport> {
    const params: Record<string, string> = { date_from: from, date_to: to };
    if (filters?.paymentMethod) params.payment_method = filters.paymentMethod;
    if (filters?.paymentBank) params.payment_bank = filters.paymentBank;
    const { data: res } = await api.get('/reports/range', { params });
    return mapRangeReport(res.data);
  }

  async getWeekly(week: string): Promise<RangeReport> {
    const { data: res } = await api.get('/reports/weekly', { params: { week } });
    return mapRangeReport(res.data);
  }

  async getMonthly(month: string): Promise<RangeReport> {
    const { data: res } = await api.get('/reports/monthly', { params: { month } });
    return mapRangeReport(res.data);
  }
}
