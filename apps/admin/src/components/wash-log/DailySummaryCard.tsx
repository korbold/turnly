'use client';

import type { DailySummary } from '@/types/wash-log';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, DollarSign } from 'lucide-react';

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

interface DailySummaryCardProps {
  summary: DailySummary;
}

export function DailySummaryCard({ summary }: DailySummaryCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Resumen del día
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Total servicios realizados</span>
            <span className="font-bold text-lg">{summary.total_washes}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Total ingresos
            </span>
            <span className="font-bold text-lg">${Number(summary.total_revenue).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por método de pago</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(summary.by_payment_method).length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(summary.by_payment_method).map(([method, stats]) => (
                <div key={method} className="flex justify-between items-center py-1 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium">{paymentLabels[method] ?? method}</span>
                    <span className="text-xs text-muted-foreground ml-2">({stats.count} servicios)</span>
                  </div>
                  <span className="font-medium">${Number(stats.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
