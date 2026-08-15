'use client';

import { CreditCard, Banknote, ArrowLeftRight, MoreHorizontal } from 'lucide-react';
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

/**
 * Every method the cashier can pick in "Registrar servicio" needs a tile
 * here — the caja del día has to add up. Transferencia was missing, so a
 * day paid entirely by transfer showed revenue with $0 in both tiles.
 */
const METHOD_TILES = [
  { key: 'card', label: 'Tarjeta', Icon: CreditCard, iconBg: 'bg-[var(--info-50)]', iconFg: 'text-[var(--info-700)]' },
  { key: 'cash', label: 'Efectivo', Icon: Banknote, iconBg: 'bg-[var(--warning-50)]', iconFg: 'text-[var(--warning-700)]' },
  { key: 'transfer', label: 'Transferencia', Icon: ArrowLeftRight, iconBg: 'bg-[var(--success-50)]', iconFg: 'text-[var(--success-700)]' },
  { key: 'other', label: 'Otro', Icon: MoreHorizontal, iconBg: 'bg-[var(--bg-sunken)]', iconFg: 'text-[var(--fg-secondary)]' },
] as const;

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

      {/* One tile per payment method. "Otro" only shows up once it has
          money in it, so the common two-method day stays uncluttered. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {METHOD_TILES.filter(
          (m) => m.key !== 'other' || (data?.byPaymentMethod?.other?.total ?? 0) > 0,
        ).map(({ key, label, Icon, iconBg, iconFg }) => (
          <section
            key={key}
            aria-label={`Pagos: ${label}`}
            className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${iconBg}`}>
                <Icon className={`h-4 w-4 ${iconFg}`} aria-hidden="true" />
              </span>
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                {label}
              </p>
            </div>
            <p
              className="mt-3 text-[22px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {fmt(data?.byPaymentMethod?.[key]?.total ?? 0)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
