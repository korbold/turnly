'use client';

import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';

interface RevenueData {
  label: string;
  amount: number;
  trend: number;
  sparkline: string;
  dateRange: { from: string; to: string };
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const startOfMonthStr = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const MOCK_REVENUE: RevenueData[] = [
  {
    label: 'Hoy',
    amount: 450000,
    trend: 12.5,
    sparkline: 'M 0 24 L 12 18 L 24 22 L 36 14 L 48 16 L 60 8 L 76 6',
    dateRange: { from: todayStr(), to: todayStr() },
  },
  {
    label: 'Esta semana',
    amount: 2850000,
    trend: -3.2,
    sparkline: 'M 0 12 L 12 16 L 24 14 L 36 22 L 48 18 L 60 24 L 76 22',
    dateRange: { from: daysAgoStr(7), to: todayStr() },
  },
  {
    label: 'Este mes',
    amount: 12400000,
    trend: 8.1,
    sparkline: 'M 0 22 L 12 18 L 24 20 L 36 14 L 48 12 L 60 10 L 76 8',
    dateRange: { from: startOfMonthStr(), to: todayStr() },
  },
  {
    label: 'Ticket promedio',
    amount: 48500,
    trend: 4.2,
    sparkline: 'M 0 18 L 12 16 L 24 18 L 36 14 L 48 16 L 60 12 L 76 10',
    dateRange: { from: startOfMonthStr(), to: todayStr() },
  },
];

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function RevenueSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="mb-1 h-6 w-32" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RevenueCards({ isLoading = false }: { isLoading?: boolean }) {
  const router = useRouter();

  if (isLoading) return <RevenueSkeleton />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {MOCK_REVENUE.map((item) => {
        const positive = item.trend >= 0;
        return (
          <Card
            key={item.label}
            className="cursor-pointer transition-shadow hover:shadow-sm"
            onClick={() =>
              router.push(
                `/reports?from=${item.dateRange.from}&to=${item.dateRange.to}`
              )
            }
          >
            <CardContent className="p-4">
              <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                {item.label}
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className="truncate text-[22px] font-semibold leading-[1.1] text-[var(--fg-strong)] tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {formatCOP(item.amount)}
                  </div>
                  <div
                    className={cn(
                      'mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold',
                      positive
                        ? 'text-[var(--success-700)]'
                        : 'text-[var(--danger-700)]'
                    )}
                  >
                    {positive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {positive ? '+' : ''}
                    {item.trend}%
                  </div>
                </div>
                <svg
                  width="76"
                  height="32"
                  viewBox="0 0 76 32"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d={item.sparkline}
                    fill="none"
                    stroke="var(--brand-500)"
                    strokeWidth="1.5"
                  />
                  <path
                    d={`${item.sparkline} L 76 32 L 0 32 Z`}
                    fill="var(--brand-50)"
                    opacity="0.6"
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
