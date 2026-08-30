'use client';

import { Activity, CalendarCheck, TrendingUp, Wallet } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import type { ReportStats } from '@/domain/repositories/report.repository';
import { formatCurrency } from '@/shared/utils/format';

interface StatsCardsProps {
  stats?: ReportStats;
  isLoading: boolean;
  /** Hay un filtro de método activo: el titular deja de ser "lo que se
   *  facturó en el rango" y pasa a ser "la plata que entró", que puede
   *  incluir tickets de días anteriores cobrados dentro del rango. */
  byPaymentMethod?: boolean;
}

export function StatsCards({ stats, isLoading, byPaymentMethod = false }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  // Headline is money taken, so it agrees with the payment-method donut below.
  // What is charged but not collected gets said out loud instead of hiding in
  // the gap between the two — this is the screen the accountant closes on.
  const collected = stats?.collectedRevenue ?? 0;
  const unpaid = stats?.unpaidRevenue ?? 0;
  const unpaidCount = stats?.unpaidCount ?? 0;
  const totalServices = stats?.totalServices ?? 0;
  const totalReservations = stats?.totalReservations ?? 0;
  const averageDaily = stats?.averageDailyRevenue ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-4 print:gap-2">
      {/* Hero: Ingresos */}
      <section
        aria-label="Ingresos del rango"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 print:p-3"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Ingresos
        </p>
        <p
          className="mt-2 text-[34px] font-bold leading-none tabular-nums text-[var(--fg-strong)] print:mt-1 print:text-[22px]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatCurrency(collected)}
        </p>
        <p className="mt-2 text-[13px] text-[var(--fg-secondary)] print:mt-1 print:text-[11px]">
          {totalServices === 0
            ? 'Sin servicios en este rango'
            : `${totalServices} ${totalServices === 1 ? 'servicio' : 'servicios'} ${
                byPaymentMethod ? 'cobrados' : 'registrados'
              }`}
        </p>
        {unpaid > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)] print:mt-1">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCurrency(unpaid)} sin cobrar
            <span className="font-normal opacity-80">
              · {unpaidCount} {unpaidCount === 1 ? 'servicio' : 'servicios'}
            </span>
          </p>
        )}
      </section>

      {/* Secondary metrics. Inline on print so the 4 stats sit on one row. */}
      <div className="grid grid-cols-3 gap-3 print:contents">
        <SecondaryCard
          icon={Activity}
          label="Servicios"
          value={totalServices.toLocaleString('es-EC')}
        />
        <SecondaryCard
          icon={CalendarCheck}
          label="Reservas"
          value={totalReservations.toLocaleString('es-EC')}
        />
        <SecondaryCard
          icon={TrendingUp}
          label="Promedio diario"
          value={formatCurrency(averageDaily)}
        />
      </div>
    </div>
  );
}

interface SecondaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function SecondaryCard({ icon: Icon, label, value }: SecondaryCardProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-sunken)]">
          <Icon className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          {label}
        </p>
      </div>
      <p
        className="mt-3 truncate text-[20px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </p>
    </section>
  );
}
