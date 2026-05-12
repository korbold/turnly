'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import type { DailyBreakdown } from '@/domain/repositories/report.repository';
import { formatCurrency } from '@/shared/utils/format';

interface RevenueChartProps {
  data?: DailyBreakdown[];
  isLoading: boolean;
}

function formatAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Ingresos por día"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        Ingresos por día
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        ...d,
        label: format(parseISO(d.date), 'd MMM', { locale: es }),
      })),
    [data]
  );

  const hasData = chartData.length > 0 && chartData.some((d) => (d.revenue ?? 0) > 0);

  if (isLoading) {
    return (
      <ChartShell>
        <Skeleton className="h-64 w-full" />
      </ChartShell>
    );
  }

  if (!hasData) {
    return (
      <ChartShell>
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <LineChart className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--fg-strong)]">
            Sin ingresos en este rango
          </p>
          <p className="mt-1 max-w-xs text-[12.5px] text-[var(--fg-secondary)]">
            Cuando registres servicios, verás la curva de ingresos día por día.
          </p>
        </div>
      </ChartShell>
    );
  }

  return (
    <ChartShell>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand-500)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--brand-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--fg-secondary)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatAxis}
            tick={{ fontSize: 12, fill: 'var(--fg-secondary)' }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), 'Ingresos']}
            labelStyle={{ fontWeight: 600 }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--brand-500)"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
