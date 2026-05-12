'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { formatCurrency } from '@/shared/utils/format';

interface PaymentDonutProps {
  data?: Record<string, { count: number; total: number }>;
  isLoading: boolean;
}

// Use semantic tokens via CSS vars. No raw hex on charts.
const COLORS: Record<string, string> = {
  cash: 'var(--warning-500)',
  card: 'var(--info-500)',
  transfer: 'var(--success-500)',
  other: 'var(--ink-400)',
};

const LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Métodos de pago"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        Métodos de pago
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PaymentDonut({ data, isLoading }: PaymentDonutProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .filter(([, val]) => val.total > 0)
      .map(([key, val]) => ({
        name: LABELS[key] ?? key,
        value: val.total,
        count: val.count,
        color: COLORS[key] ?? 'var(--ink-400)',
      }));
  }, [data]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (isLoading) {
    return (
      <ChartShell>
        <Skeleton className="mx-auto h-48 w-48 rounded-full" />
      </ChartShell>
    );
  }

  if (chartData.length === 0) {
    return (
      <ChartShell>
        <div className="flex h-48 flex-col items-center justify-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <Wallet className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--fg-strong)]">
            Sin pagos en este rango
          </p>
        </div>
      </ChartShell>
    );
  }

  return (
    <ChartShell>
      <div className="flex flex-col items-center gap-4">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <ul className="w-full space-y-2" role="list">
          {chartData.map((item) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
            return (
              <li
                key={item.name}
                className="flex items-center justify-between text-[13px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[var(--fg)]">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="font-semibold tabular-nums text-[var(--fg-strong)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {formatCurrency(item.value)}
                  </span>
                  <span className="w-9 text-right text-[12px] tabular-nums text-[var(--fg-muted)]">
                    {pct}%
                  </span>
                </div>
              </li>
            );
          })}
          <li className="flex items-center justify-between border-t border-[var(--border)] pt-2 text-[13px]">
            <span className="font-semibold text-[var(--fg-strong)]">Total</span>
            <span
              className="font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {formatCurrency(total)}
            </span>
          </li>
        </ul>
      </div>
    </ChartShell>
  );
}
