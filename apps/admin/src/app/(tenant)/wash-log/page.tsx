'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { getWashLogs, getDailySummary } from '@/lib/api/wash-log';
import { DailyLogTable } from '@/components/wash-log/DailyLogTable';
import { DailySummaryCard } from '@/components/wash-log/DailySummaryCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

export default function WashLogPage() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['wash-logs', date],
    queryFn: () => getWashLogs({ date, per_page: 100 }),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['daily-summary', date],
    queryFn: () => getDailySummary(date),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Libro Diario</h1>
          <p className="text-gray-500">Registro de lavados del día</p>
        </div>
        <Link href="/wash-log/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Registrar lavado
          </Button>
        </Link>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Fecha:</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
      </div>

      {/* Log table */}
      <Card>
        <CardHeader>
          <CardTitle>Lavados del día</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <DailyLogTable logs={logsData?.data ?? []} date={date} />
          )}
        </CardContent>
      </Card>

      {/* Daily summary */}
      {summaryLoading ? (
        <div className="text-center py-4 text-muted-foreground">Cargando resumen...</div>
      ) : summary ? (
        <DailySummaryCard summary={summary} />
      ) : null}
    </div>
  );
}
