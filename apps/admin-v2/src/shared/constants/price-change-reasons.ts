/**
 * Espejo de `App\Domain\Pricing\PriceChangeReason`. Lista cerrada a propósito:
 * texto libre se degrada a "descuento", "x", "asd" en un mes y deja el
 * reporte sin agrupar.
 *
 * Si acá y el backend divergen, el backend rechaza con REASON_INVALID.
 */
export const PRICE_CHANGE_REASONS = [
  { code: 'cliente_frecuente', label: 'Cliente frecuente' },
  { code: 'promocion',         label: 'Promoción' },
  { code: 'cortesia',          label: 'Reclamo o cortesía' },
  { code: 'acordado',          label: 'Precio acordado con el dueño' },
  { code: 'otro',              label: 'Otro' },
] as const;

export type PriceChangeReasonCode = (typeof PRICE_CHANGE_REASONS)[number]['code'];

/** El único que exige nota escrita. */
export const REASON_REQUIRES_NOTE: PriceChangeReasonCode = 'otro';

export const REASON_LABEL: Record<string, string> = Object.fromEntries(
  PRICE_CHANGE_REASONS.map((r) => [r.code, r.label]),
);
