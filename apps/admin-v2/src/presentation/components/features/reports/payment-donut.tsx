'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';

interface PaymentDonutProps {
  data?: Record<string, { count: number; total: number }>;
  isLoading: boolean;
}

const COLORS: Record<string, string> = {
  cash: '#4F46E5',
  card: '#06B6D4',
  transfer: '#F59E0B',
};

const LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PaymentDonut({ data, isLoading }: PaymentDonutProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).map(([key, val]) => ({
      name: LABELS[key] ?? key,
      value: val.total,
      count: val.count,
      color: COLORS[key] ?? '#94A3B8',
    }));
  }, [data]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Metodos de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="mx-auto h-48 w-48 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Metodos de Pago</CardTitle>
      </CardHeader>
      <CardContent>
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
                formatter={(value) => formatCOP(Number(value))}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="w-full space-y-2">
            {chartData.map((item) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCOP(item.value)}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-2">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCOP(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
