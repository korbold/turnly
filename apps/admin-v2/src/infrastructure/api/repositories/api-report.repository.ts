import type { ReportRepository, RangeReport, ReportStats, DailyBreakdown } from '@/domain/repositories/report.repository';
import api from '../client';

function mapStats(raw: Record<string, unknown>): ReportStats {
  return {
    totalServices: (raw.total_services ?? raw.totalServices) as number,
    totalRevenue: (raw.total_revenue ?? raw.totalRevenue) as number,
    totalReservations: (raw.total_reservations ?? raw.totalReservations) as number,
    averageDailyRevenue: (raw.average_daily_revenue ?? raw.averageDailyRevenue) as number,
  };
}

function mapDailyBreakdown(raw: Record<string, unknown>): DailyBreakdown {
  return {
    date: raw.date as string,
    services: raw.services as number,
    revenue: raw.revenue as number,
    byCash: (raw.by_cash ?? raw.byCash) as number,
    byCard: (raw.by_card ?? raw.byCard) as number,
    byTransfer: (raw.by_transfer ?? raw.byTransfer) as number,
    reservations: raw.reservations as number,
  };
}

function mapRangeReport(raw: Record<string, unknown>): RangeReport {
  return {
    stats: mapStats(raw.stats as Record<string, unknown>),
    dailyBreakdown: ((raw.daily_breakdown ?? raw.dailyBreakdown) as Record<string, unknown>[]).map(
      mapDailyBreakdown,
    ),
    byPaymentMethod: (raw.by_payment_method ?? raw.byPaymentMethod ?? {}) as Record<
      string,
      { count: number; total: number }
    >,
  };
}

export class ApiReportRepository implements ReportRepository {
  async getDaily(date: string): Promise<RangeReport> {
    const { data: res } = await api.get('/reports/daily', { params: { date } });
    return mapRangeReport(res.data);
  }

  async getRange(from: string, to: string): Promise<RangeReport> {
    const { data: res } = await api.get('/reports/range', { params: { date_from: from, date_to: to } });
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
