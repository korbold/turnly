'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useRangeReport } from '@/presentation/hooks/use-reports';
import { cn } from '@/shared/utils/cn';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfMonthStr(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function startOfPrevMonthStr(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function endOfPrevMonthStr(): string {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function trendPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildSparkline(values: number[]): string {
  if (values.length === 0) return 'M 0 16 L 76 16';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? 76 / (values.length - 1) : 76;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = 28 - ((v - min) / range) * 24;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

interface KpiCardProps {
  label: string;
  amount: number;
  trend: number;
  sparkline: string;
  href: string;
  isLoading?: boolean;
}

function KpiCard({ label, amount, trend, sparkline, href, isLoading }: KpiCardProps) {
  const router = useRouter();
  const positive = trend >= 0;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-sm"
      onClick={() => router.push(href)}
    >
      <CardContent className="p-4">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          {label}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="mb-1 h-6 w-28" />
                <Skeleton className="h-3 w-12" />
              </>
            ) : (
              <>
                <div
                  className="truncate text-[22px] font-semibold leading-[1.1] text-[var(--fg-strong)] tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}
                >
                  {formatCOP(amount)}
                </div>
                <div
                  className={cn(
                    'mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold',
                    positive ? 'text-[var(--success-700)]' : 'text-[var(--danger-700)]'
                  )}
                >
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {positive ? '+' : ''}
                  {trend}%
                </div>
              </>
            )}
          </div>
          <svg width="76" height="32" viewBox="0 0 76 32" className="shrink-0" aria-hidden="true">
            <path d={sparkline} fill="none" stroke="var(--brand-500)" strokeWidth="1.5" />
            <path d={`${sparkline} L 76 32 L 0 32 Z`} fill="var(--brand-50)" opacity="0.6" />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueCards() {
  const today = todayStr();
  const weekStart = daysAgoStr(6);
  const prevWeekStart = daysAgoStr(13);
  const prevWeekEnd = daysAgoStr(7);
  const monthStart = startOfMonthStr();
  const prevMonthStart = startOfPrevMonthStr();
  const prevMonthEnd = endOfPrevMonthStr();

  const todayQuery = useRangeReport(today, today);
  const yesterdayQuery = useRangeReport(daysAgoStr(1), daysAgoStr(1));
  const weekQuery = useRangeReport(weekStart, today);
  const prevWeekQuery = useRangeReport(prevWeekStart, prevWeekEnd);
  const monthQuery = useRangeReport(monthStart, today);
  const prevMonthQuery = useRangeReport(prevMonthStart, prevMonthEnd);

  const isLoading =
    todayQuery.isLoading ||
    weekQuery.isLoading ||
    monthQuery.isLoading;

  const { hoy, semana, mes, ticket } = useMemo(() => {
    const todayRevenue = todayQuery.data?.stats.totalRevenue ?? 0;
    const yesterdayRevenue = yesterdayQuery.data?.stats.totalRevenue ?? 0;
    const weekRevenue = weekQuery.data?.stats.totalRevenue ?? 0;
    const prevWeekRevenue = prevWeekQuery.data?.stats.totalRevenue ?? 0;
    const monthRevenue = monthQuery.data?.stats.totalRevenue ?? 0;
    const prevMonthRevenue = prevMonthQuery.data?.stats.totalRevenue ?? 0;

    const monthRes = monthQuery.data?.stats.totalReservations ?? 0;
    const prevMonthRes = prevMonthQuery.data?.stats.totalReservations ?? 0;
    const ticketAvg = monthRes > 0 ? monthRevenue / monthRes : 0;
    const prevTicketAvg = prevMonthRes > 0 ? prevMonthRevenue / prevMonthRes : 0;

    const weekDays = (weekQuery.data?.dailyBreakdown ?? []).map((d) => d.revenue ?? 0);
    const monthDays = (monthQuery.data?.dailyBreakdown ?? []).map((d) => d.revenue ?? 0);

    return {
      hoy: {
        amount: todayRevenue,
        trend: trendPct(todayRevenue, yesterdayRevenue),
        sparkline: buildSparkline(weekDays.length ? weekDays : [0]),
      },
      semana: {
        amount: weekRevenue,
        trend: trendPct(weekRevenue, prevWeekRevenue),
        sparkline: buildSparkline(weekDays.length ? weekDays : [0]),
      },
      mes: {
        amount: monthRevenue,
        trend: trendPct(monthRevenue, prevMonthRevenue),
        sparkline: buildSparkline(monthDays.length ? monthDays : [0]),
      },
      ticket: {
        amount: Math.round(ticketAvg),
        trend: trendPct(ticketAvg, prevTicketAvg),
        sparkline: buildSparkline(monthDays.length ? monthDays : [0]),
      },
    };
  }, [
    todayQuery.data,
    yesterdayQuery.data,
    weekQuery.data,
    prevWeekQuery.data,
    monthQuery.data,
    prevMonthQuery.data,
  ]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Hoy"
        amount={hoy.amount}
        trend={hoy.trend}
        sparkline={hoy.sparkline}
        href={`/reports?from=${today}&to=${today}`}
        isLoading={isLoading}
      />
      <KpiCard
        label="Esta semana"
        amount={semana.amount}
        trend={semana.trend}
        sparkline={semana.sparkline}
        href={`/reports?from=${weekStart}&to=${today}`}
        isLoading={isLoading}
      />
      <KpiCard
        label="Este mes"
        amount={mes.amount}
        trend={mes.trend}
        sparkline={mes.sparkline}
        href={`/reports?from=${monthStart}&to=${today}`}
        isLoading={isLoading}
      />
      <KpiCard
        label="Ticket promedio"
        amount={ticket.amount}
        trend={ticket.trend}
        sparkline={ticket.sparkline}
        href={`/reports?from=${monthStart}&to=${today}`}
        isLoading={isLoading}
      />
    </div>
  );
}
