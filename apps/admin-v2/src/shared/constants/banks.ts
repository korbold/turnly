/**
 * Ecuadorian banks the cashier picks from when the customer pays via
 * transferencia. Kept as a flat array so the order in the UI matches
 * market share — Pichincha + Pacífico + Guayaquil first. Brand colors
 * sampled from each bank's official identity guide so the chip reads
 * the same as the customer's banking app.
 *
 * Stored as `slug` on the reservation. New regional banks can be added
 * here without a backend migration (the column is a free-form string).
 */

export interface Bank {
  slug: string;
  name: string;
  /** Background color of the chip — brand color of the bank. */
  color: string;
  /** Foreground color used for the initial inside the chip. */
  fg: string;
  /** Short label rendered inside the chip (1-3 chars). */
  initials: string;
}

export const ECUADOR_BANKS: Bank[] = [
  { slug: 'pichincha',    name: 'Banco Pichincha',     color: '#FFC72C', fg: '#1B1B1B', initials: 'BP' },
  { slug: 'pacifico',     name: 'Banco del Pacífico',  color: '#003F8F', fg: '#FFFFFF', initials: 'BP' },
  { slug: 'guayaquil',    name: 'Banco Guayaquil',     color: '#007934', fg: '#FFFFFF', initials: 'BG' },
  { slug: 'produbanco',   name: 'Produbanco',          color: '#E30613', fg: '#FFFFFF', initials: 'PB' },
  { slug: 'bolivariano',  name: 'Banco Bolivariano',   color: '#0066A1', fg: '#FFFFFF', initials: 'BB' },
  { slug: 'internacional', name: 'Banco Internacional', color: '#002D62', fg: '#FFFFFF', initials: 'BI' },
  { slug: 'austro',       name: 'Banco del Austro',    color: '#1B4F8A', fg: '#FFFFFF', initials: 'BA' },
  { slug: 'loja',         name: 'Banco de Loja',       color: '#008C45', fg: '#FFFFFF', initials: 'BL' },
  { slug: 'solidario',    name: 'Banco Solidario',     color: '#E2231A', fg: '#FFFFFF', initials: 'BS' },
  { slug: 'machala',      name: 'Banco de Machala',    color: '#E5751F', fg: '#FFFFFF', initials: 'BM' },
  { slug: 'jep',          name: 'Cooperativa JEP',     color: '#1E8B3F', fg: '#FFFFFF', initials: 'JEP' },
  { slug: 'diners',       name: 'Diners Club',         color: '#0079BE', fg: '#FFFFFF', initials: 'DC' },
  { slug: 'other',        name: 'Otro banco',          color: '#6B7280', fg: '#FFFFFF', initials: '$' },
];

export function findBank(slug: string | null | undefined): Bank | null {
  if (!slug) return null;
  return ECUADOR_BANKS.find((b) => b.slug === slug) ?? null;
}
