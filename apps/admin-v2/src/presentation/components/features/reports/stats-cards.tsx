'use client';

import { Activity, DollarSign, CalendarCheck, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import type { ReportStats } from '@/domain/repositories/report.repository';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CARDS = [
  { key: 'totalServices' as const, label: 'Total Servicios', icon: Activity, format: (v: number) => v.toLocaleString() },
  { key: 'totalRevenue' as const, label: 'Ingresos', icon: DollarSign, format: formatCOP },
  { key: 'totalReservations' as const, label: 'Reservaciones', icon: CalendarCheck, format: (v: number) => v.toLocaleString() },
  { key: 'averageDailyRevenue' as const, label: 'Promedio Diario', icon: TrendingUp, format: formatCOP },
];

interface StatsCardsProps {
  stats?: ReportStats;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Card key={c.key}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats?.[card.key] ?? 0;
        return (
          <Card key={card.key}>
            <CardContent className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <div className="rounded-md bg-indigo-50 p-1.5">
                  <Icon className="h-4 w-4 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-xl font-semibold text-zinc-900">{card.format(value)}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
