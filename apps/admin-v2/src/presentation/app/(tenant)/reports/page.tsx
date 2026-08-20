'use client';

import { Suspense } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileDown, FilterX } from 'lucide-react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useRangeReport } from '@/presentation/hooks/use-reports';
import { useMe } from '@/presentation/hooks/use-auth';
import { RangeSelector } from '@/presentation/components/features/reports/range-selector';
import { StatsCards } from '@/presentation/components/features/reports/stats-cards';
import { RevenueChart } from '@/presentation/components/features/reports/revenue-chart';
import { PaymentDonut } from '@/presentation/components/features/reports/payment-donut';
import { DailyTable } from '@/presentation/components/features/reports/daily-table';
import { ServiceLogTable } from '@/presentation/components/features/reports/service-log-table';
import { DiscountsSection } from '@/presentation/components/features/reports/discounts-section';
import { MethodFilter } from '@/presentation/components/features/reports/method-filter';
import { findBank } from '@/shared/constants/banks';

const today = format(new Date(), 'yyyy-MM-dd');

function ReportsContent() {
  const [from, setFrom] = useQueryState('from', parseAsString.withDefault(today));
  const [to, setTo] = useQueryState('to', parseAsString.withDefault(today));
  const [method, setMethod] = useQueryState(
    'method',
    parseAsStringEnum(['cash', 'card', 'transfer']),
  );
  const [bank, setBank] = useQueryState('bank', parseAsString);

  const { data: me } = useMe();
  const { data: report, isLoading } = useRangeReport(from, to, {
    paymentMethod: method,
    paymentBank: bank,
  });

  // Bank picker only shows banks with paid transferencias in the
  // current range, so a fresh tenant with no transfer activity still
  // gets to filter without scrolling past 13 empty options.
  // From the API's unfiltered list, not from byBank: byBank shrinks to the
  // selected bank, which used to leave the chips with nowhere to switch to.
  const availableBanks = report?.availableBanks ?? [];

  function handleRangeChange(newFrom: string, newTo: string) {
    setFrom(newFrom);
    setTo(newTo);
  }

  function handleExportPDF() {
    // Browser print dialog handles save-as-PDF, real printer, and PNG
    // export depending on what the user picks — cheaper than bundling a
    // PDF engine and adapts to whatever paper / locale they need. Print
    // CSS in globals.css strips the shell and tightens the layout.
    window.print();
  }

  const fmtRangeDate = (iso: string) =>
    format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });

  const activeBank = bank ? findBank(bank) : null;
  const methodLabel =
    method === 'cash' ? 'Efectivo' :
    method === 'card' ? 'Tarjeta' :
    method === 'transfer' ? 'Transferencia' : null;

  const hasFilter = method !== null || bank !== null;
  const everythingIsZero = (report?.stats.totalRevenue ?? 0) === 0 && !isLoading;

  return (
    <div className="space-y-5">
      {/* Print-only header — invisible on screen, replaces the app shell
          on the printed page. Carries tenant identity, the date range
          the report covers, and any active filters so the print itself
          is self-contained when the cashier hands it to an accountant. */}
      <header className="hidden print:mb-6 print:block print:border-b print:border-zinc-300 print:pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Reporte de operación
            </p>
            <h1 className="mt-1 text-[20px] font-bold text-zinc-900">
              {me?.tenant?.name ?? 'Turnly'}
            </h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">
              {from === to
                ? fmtRangeDate(from)
                : `${fmtRangeDate(from)} — ${fmtRangeDate(to)}`}
            </p>
          </div>
          <div className="text-right text-[11px] leading-relaxed text-zinc-600">
            <p>
              Generado {format(new Date(), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
            </p>
            {(methodLabel || activeBank) && (
              <p className="mt-0.5">
                Filtro: {[methodLabel, activeBank?.name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-2">
          <RangeSelector from={from} to={to} onChange={handleRangeChange} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            title="Imprime o guarda como PDF (Cmd+P / Ctrl+P)"
            className="cursor-pointer"
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters — sit on a tinted strip so they read as a separate
          layer from the range chips above. */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5 print:hidden">
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
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
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

      {/* Owner/admin only — the backend already 403s everyone else, this
          just keeps the section from rendering and then erroring. */}
      <DiscountsSection from={from} to={to} />

      {/* The rows behind the totals, so the report can be handed over as-is
          instead of "trust me, it adds up". Follows the filters above. */}
      <ServiceLogTable from={from} to={to} paymentMethod={method} paymentBank={bank} />
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
