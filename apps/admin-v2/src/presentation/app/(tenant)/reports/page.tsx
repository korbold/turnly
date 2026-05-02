'use client';

import { Suspense } from 'react';
import { format } from 'date-fns';
import { FileDown } from 'lucide-react';
import { useQueryState, parseAsString } from 'nuqs';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useRangeReport } from '@/presentation/hooks/use-reports';
import { RangeSelector } from '@/presentation/components/features/reports/range-selector';
import { StatsCards } from '@/presentation/components/features/reports/stats-cards';
import { RevenueChart } from '@/presentation/components/features/reports/revenue-chart';
import { PaymentDonut } from '@/presentation/components/features/reports/payment-donut';
import { DailyTable } from '@/presentation/components/features/reports/daily-table';

const today = format(new Date(), 'yyyy-MM-dd');

function ReportsContent() {
  const [from, setFrom] = useQueryState('from', parseAsString.withDefault(today));
  const [to, setTo] = useQueryState('to', parseAsString.withDefault(today));

  const { data: report, isLoading } = useRangeReport(from, to);

  function handleRangeChange(newFrom: string, newTo: string) {
    setFrom(newFrom);
    setTo(newTo);
  }

  function handleExportPDF() {
    // Placeholder - will be implemented later
    console.log('Export PDF for range:', from, to);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <RangeSelector from={from} to={to} onChange={handleRangeChange} />
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <StatsCards stats={report?.stats} isLoading={isLoading} />

      {/* Revenue chart */}
      <RevenueChart data={report?.dailyBreakdown} isLoading={isLoading} />

      {/* Payment donut + Daily table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PaymentDonut data={report?.byPaymentMethod} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <DailyTable
            data={report?.dailyBreakdown}
            isLoading={isLoading}
            onRowClick={(date) => {
              setFrom(date);
              setTo(date);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
