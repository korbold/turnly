// Ecuador uses period as decimal separator and comma for thousands.
// es-EC via Intl renders comma as decimal which is wrong.
// en-US renders "$1,234.56" — correct format for USD in Ecuador.
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyDecimalFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, opts?: { decimals?: boolean }): string {
  const fmt = opts?.decimals ? currencyDecimalFormatter : currencyFormatter;
  return fmt.format(value).replace(/ /g, ' ').replace(/\$\s+/, '$');
}

/**
 * The counter's money format: cents only when the amount has them, and
 * then always two. `minimumFractionDigits: 0` alone renders 3.5 as
 * "$3.5", which reads like a typo on a price tag.
 *
 * Separate from formatCurrency because that one is pinned to whole
 * dollars across reports, reservations and facturas — changing it would
 * move figures on screens nobody asked about.
 */
export function formatCounterCurrency(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatShortCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Una fecha sin hora ("2026-08-24") interpretada en la zona del local.
 *
 * `new Date('2026-08-24')` es medianoche UTC, que en Ecuador son las 19:00 del
 * día anterior: la deuda de hoy se leía "23 ago". Un renglón de cobro con la
 * fecha corrida es justo el que el cliente discute en el mostrador.
 *
 * Las cadenas que ya traen hora se dejan pasar tal cual — ahí no hay ambigüedad.
 */
export function parseDayLocal(value: string): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!soloFecha) return new Date(value);
  const [, y, m, d] = soloFecha;
  return new Date(Number(y), Number(m) - 1, Number(d));
}
