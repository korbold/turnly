'use client';

import { Suspense, useMemo } from 'react';
import { format } from 'date-fns';
import { FileDown, FilterX } from 'lucide-react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useRangeReport } from '@/presentation/hooks/use-reports';
import { RangeSelector } from '@/presentation/components/features/reports/range-selector';
import { StatsCards } from '@/presentation/components/features/reports/stats-cards';
import { RevenueChart } from '@/presentation/components/features/reports/revenue-chart';
import { PaymentDonut } from '@/presentation/components/features/reports/payment-donut';
import { DailyTable } from '@/presentation/components/features/reports/daily-table';
import { MethodFilter } from '@/presentation/components/features/reports/method-filter';

const today = format(new Date(), 'yyyy-MM-dd');

function ReportsContent() {
  const [from, setFrom] = useQueryState('from', parseAsString.withDefault(today));
  const [to, setTo] = useQueryState('to', parseAsString.withDefault(today));
  const [method, setMethod] = useQueryState(
    'method',
    parseAsStringEnum(['cash', 'card', 'transfer']),
  );
  const [bank, setBank] = useQueryState('bank', parseAsString);

  const { data: report, isLoading } = useRangeReport(from, to, {
    paymentMethod: method,
    paymentBank: bank,
  });

  // Bank picker only shows banks with paid transferencias in the
  // current range, so a fresh tenant with no transfer activity still
  // gets to filter without scrolling past 13 empty options.
  const availableBanks = useMemo(
    () => Object.keys(report?.byBank ?? {}),
    [report?.byBank],
  );

  function handleRangeChange(newFrom: string, newTo: string) {
    setFrom(newFrom);
    setTo(newTo);
  }

  function handleExportPDF() {
    // Placeholder - will be implemented later
    console.log('Export PDF for range:', from, to);
  }

  const hasFilter = method !== null || bank !== null;
  const everythingIsZero = (report?.stats.totalRevenue ?? 0) === 0 && !isLoading;

  return (
    <div className="space-y-5">
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

      {/* Filters — sit on a tinted strip so they read as a separate
          layer from the range chips above. */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
        <MethodFilter
          method={method}
          bank={bank}
          availableBanks={availableBanks}
          onMethodChange={setMethod}
          onBankChange={setBank}
        />
      </div>

      {/* Filtered-but-empty banner — clear feedback so the cashier
          doesn't stare at $0 wondering whether it's the filter or
          actually no activity. */}
      {hasFilter && everythingIsZero && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--fg-strong)]">
              Sin actividad para estos filtros
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">
              Cambia el método, el banco o el rango para ver datos.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMethod(null);
              setBank(null);
            }}
            className="cursor-pointer"
          >
            <FilterX className="mr-1.5 h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        </div>
      )}

      {/* Stats row */}
      <StatsCards stats={report?.stats} isLoading={isLoading} />

      {/* Revenue chart */}
      <RevenueChart data={report?.dailyBreakdown} isLoading={isLoading} />

      {/* Payment donut + Daily table.
          When a method filter is active the donut collapses to a
          single slice and stops carrying signal, so we hand the table
          the full width instead. */}
      {method === null ? (
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
      ) : (
        <DailyTable
          data={report?.dailyBreakdown}
          isLoading={isLoading}
          onRowClick={(date) => {
            setFrom(date);
            setTo(date);
          }}
        />
      )}
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
