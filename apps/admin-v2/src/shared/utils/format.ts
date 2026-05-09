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

export function formatShortCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
