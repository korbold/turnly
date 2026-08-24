'use client';

import { useState } from 'react';
import { CreditCard, Banknote, ArrowLeftRight, MoreHorizontal, Wallet, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useDailySummary } from '@/presentation/hooks/use-service-logs';
import { useCashSession } from '@/presentation/hooks/use-cash-session';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import { formatCounterCurrency } from '@/shared/utils/format';

const fmt = (v: number) => formatCounterCurrency(v).replace(/ /g, ' ');

const MASK = '••••';

const HIDE_AMOUNTS_KEY = 'turnly:service-log:hide-amounts';

/**
 * Whether the cashier chose to keep the day's figures off screen — a customer
 * standing at the counter shouldn't read the caja. Persisted so a reload does
 * not put the money back on display. Reading on the server returns false, which
 * is safe: this block renders a skeleton until React Query resolves on the
 * client, so no server markup depends on the value.
 */
function loadHideAmounts(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HIDE_AMOUNTS_KEY) === '1';
  } catch {
    return false;
  }
}

function saveHideAmounts(hidden: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HIDE_AMOUNTS_KEY, hidden ? '1' : '0');
  } catch {
    // localStorage full / disabled — the toggle still works for this session.
  }
}

const COLLAPSED_KEY = 'turnly:service-log:summary-collapsed';

/**
 * Folded away to give the table room. Persisted like the amount toggle, so the
 * cashier's choice survives a reload instead of springing back every morning.
 */
function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // localStorage full / disabled — the toggle still works for this session.
  }
}

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
  const { isOwnerOrAdmin } = usePermissions();
  const { data: cash, isLoading: cashLoading } = useCashSession(date);
  const [hideAmounts, setHideAmounts] = useState(loadHideAmounts);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const money = (v: number) => (hideAmounts ? MASK : fmt(v));

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  }

  function toggleAmounts() {
    setHideAmounts((prev) => {
      const next = !prev;
      saveHideAmounts(next);
      return next;
    });
  }

  // El cierre de caja es ciego: el cajero cuenta y declara, y recién
  // entonces el sistema revela el esperado. Ese control se cae si el
  // esperado se puede leer en esta misma pantalla — base + EFECTIVO da el
  // número con centavos de error. Con la caja abierta, quien va a ser
  // arqueado no ve la plata del día; al cerrarla vuelve a verla.
  //
  // No lo vuelve imposible: la tabla de abajo sigue listando cada cobro con
  // su método, y sumarla a mano funciona. Lo vuelve trabajo.
  const cajaAbierta = cash?.session?.status === 'open';
  const ocultarPorArqueo = !isOwnerOrAdmin && (cashLoading || cajaAbierta);

  if (isLoading || (cashLoading && !isOwnerOrAdmin)) {
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

  if (ocultarPorArqueo) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3">
        <EyeOff className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        <p className="text-[12.5px] text-[var(--fg-secondary)]">
          Los totales del día aparecen al cerrar la caja. Contá el efectivo antes de declararlo.
        </p>
      </div>
    );
  }

  const total = data?.totalWashes ?? 0;
  // The headline is money in the till, not everything registered — what is
  // still owed lives in its own tile. The backend splits both figures because
  // reservations carry their own payment_status.
  const collected = data?.collected?.total ?? 0;
  const unpaidTotal = data?.unpaid?.total ?? 0;
  const unpaidCount = data?.unpaid?.count ?? 0;

  const visibleMethods = METHOD_TILES.filter(
    (m) => m.key !== 'other' || (data?.byPaymentMethod?.other?.total ?? 0) > 0,
  );
  const tileCount = visibleMethods.length + (unpaidTotal > 0 ? 1 : 0);

  // ~44px instead of ~250px, with the two figures worth glancing at kept on the
  // strip. Collapsing is for room, not for going blind — and the amount toggle
  // still wins, so a masked caja stays masked here too.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={false}
        aria-label="Mostrar el resumen del día"
        className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-sunken)]/50"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Resumen del día
        </span>
        <span
          className="text-[15px] font-bold tabular-nums text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {money(collected)}
        </span>
        {unpaidTotal > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
            <Wallet className="h-3 w-3" aria-hidden="true" />
            {money(unpaidTotal)} sin cobrar
          </span>
        )}
        <ChevronDown
          className="ml-auto h-4 w-4 shrink-0 text-[var(--fg-muted)]"
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Hero: Ingresos del día */}
      <section
        aria-label="Ingresos del día"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Ingresos del día
          </p>
          <button
            type="button"
            onClick={toggleAmounts}
            aria-pressed={hideAmounts}
            aria-label={hideAmounts ? 'Mostrar montos' : 'Ocultar montos'}
            title={hideAmounts ? 'Mostrar montos' : 'Ocultar montos'}
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {hideAmounts ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded
            aria-label="Ocultar el resumen del día"
            title="Ocultar el resumen del día"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
          </button>
        </div>
        <p
          className="mt-2 text-[34px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {money(collected)}
        </p>
        <p className="mt-2 text-[13px] text-[var(--fg-secondary)]">
          {total === 0
            ? 'Sin servicios todavía hoy'
            : `${total} ${total === 1 ? 'servicio registrado' : 'servicios registrados'}`}
        </p>
      </section>

      {/* One tile per payment method. "Otro" only shows up once it has
          money in it, so the common two-method day stays uncluttered.
          Exactly four tiles sit as a 2×2 block instead of 3+1, which would
          leave the hero card beside a half-empty row. */}
      <div className={`grid grid-cols-2 gap-3 ${tileCount === 4 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {visibleMethods.map(({ key, label, Icon, iconBg, iconFg }) => (
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
              {money(data?.byPaymentMethod?.[key]?.total ?? 0)}
            </p>
          </section>
        ))}

        {/* Charged but not collected yet. Without it the tiles under-report the
            day: they only cover rows that already have a payment method, while
            "Ingresos del día" counts the pending ones too. Hidden at zero so a
            fully-collected day stays quiet. Amber matches the "Pendiente" badge
            in the table below, so both read as the same thing. */}
        {unpaidTotal > 0 && (
          <section
            aria-label="Sin cobrar"
            className="flex flex-col justify-between rounded-xl border border-[var(--warning-200)] bg-[var(--warning-50)] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--warning-100)]">
                <Wallet className="h-4 w-4 text-[var(--warning-700)]" aria-hidden="true" />
              </span>
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                Sin cobrar
              </p>
            </div>
            <div className="mt-3">
              <p
                className="text-[22px] font-bold leading-none tabular-nums text-[var(--warning-700)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {money(unpaidTotal)}
              </p>
              <p className="mt-1.5 text-[11.5px] text-[var(--warning-700)]/80">
                {unpaidCount} {unpaidCount === 1 ? 'servicio' : 'servicios'}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
