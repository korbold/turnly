'use client';

import { useRouter } from 'next/navigation';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';

interface RevenueData {
  label: string;
  amount: number;
  trend: number;
  dateRange: { from: string; to: string };
}

const MOCK_REVENUE: RevenueData[] = [
  {
    label: 'Hoy',
    amount: 450000,
    trend: 12.5,
    dateRange: {
      from: new Date().toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    },
  },
  {
    label: 'Semana',
    amount: 2850000,
    trend: -3.2,
    dateRange: {
      from: (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
      })(),
      to: new Date().toISOString().slice(0, 10),
    },
  },
  {
    label: 'Mes',
    amount: 12400000,
    trend: 8.1,
    dateRange: {
      from: (() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().slice(0, 10);
      })(),
      to: new Date().toISOString().slice(0, 10),
    },
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

export function RevenueCards({ isLoading = false }: { isLoading?: boolean }) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="min-w-[180px] flex-1">
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-16" />
              <Skeleton className="mb-1 h-6 w-28" />
              <Skeleton className="h-4 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {MOCK_REVENUE.map((item) => (
        <Card
          key={item.label}
          className="min-w-[180px] flex-1 cursor-pointer transition-shadow hover:shadow-md"
          onClick={() =>
            router.push(
              `/reports?from=${item.dateRange.from}&to=${item.dateRange.to}`
            )
          }
        >
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-md bg-indigo-50 p-1.5">
                <DollarSign className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
            </div>
            <p className="text-lg font-semibold">{formatCOP(item.amount)}</p>
            <div className="mt-1 flex items-center gap-1">
              {item.trend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  item.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {item.trend >= 0 ? '+' : ''}
                {item.trend}%
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
