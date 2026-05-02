'use client';

import { DollarSign, CreditCard, Banknote, Activity } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useDailySummary } from '@/presentation/hooks/use-service-logs';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v);

interface DailySummaryProps {
  date: string;
}

export function DailySummary({ date }: DailySummaryProps) {
  const { data, isLoading } = useDailySummary(date);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const summary = data;
  const cardAmount = summary?.byPaymentMethod?.card?.total ?? 0;
  const cashAmount = summary?.byPaymentMethod?.cash?.total ?? 0;

  const cards = [
    {
      label: 'Total servicios',
      value: String(summary?.totalWashes ?? 0),
      icon: Activity,
      color: 'text-[var(--color-primary)]',
      bg: 'bg-[var(--color-primary-muted)]',
    },
    {
      label: 'Ingresos',
      value: fmt(summary?.totalRevenue ?? 0),
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Tarjeta',
      value: fmt(cardAmount),
      icon: CreditCard,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: 'Efectivo',
      value: fmt(cashAmount),
      icon: Banknote,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg p-2 ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
