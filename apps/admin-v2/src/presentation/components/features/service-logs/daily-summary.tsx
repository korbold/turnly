'use client';

import { CreditCard, Banknote } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useDailySummary } from '@/presentation/hooks/use-service-logs';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(v)
    .replace(/ /g, ' ');

interface DailySummaryProps {
  date: string;
}

export function DailySummary({ date }: DailySummaryProps) {
  const { data, isLoading } = useDailySummary(date);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  const total = data?.totalWashes ?? 0;
  const revenue = data?.totalRevenue ?? 0;
  const cardAmount = data?.byPaymentMethod?.card?.total ?? 0;
  const cashAmount = data?.byPaymentMethod?.cash?.total ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Hero: Ingresos del día */}
      <section
        aria-label="Ingresos del día"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Ingresos del día
        </p>
        <p
          className="mt-2 text-[34px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {fmt(revenue)}
        </p>
        <p className="mt-2 text-[13px] text-[var(--fg-secondary)]">
          {total === 0
            ? 'Sin servicios todavía hoy'
            : `${total} ${total === 1 ? 'servicio registrado' : 'servicios registrados'}`}
        </p>
      </section>

      {/* Split: pago tarjeta + efectivo */}
      <div className="grid grid-cols-2 gap-3">
        <section
          aria-label="Pagos con tarjeta"
          className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--info-50)]">
              <CreditCard className="h-4 w-4 text-[var(--info-700)]" aria-hidden="true" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Tarjeta
            </p>
          </div>
          <p
            className="mt-3 text-[22px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {fmt(cardAmount)}
          </p>
        </section>

        <section
          aria-label="Pagos en efectivo"
          className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--warning-50)]">
              <Banknote className="h-4 w-4 text-[var(--warning-700)]" aria-hidden="true" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Efectivo
            </p>
          </div>
          <p
            className="mt-3 text-[22px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {fmt(cashAmount)}
          </p>
        </section>
      </div>
    </div>
  );
}
