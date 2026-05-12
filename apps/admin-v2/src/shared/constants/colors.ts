export interface TenantPalette {
  name: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  accent: string;
}

/**
 * Curated tenant palettes. Coral is the Turnly brand default; others give
 * tenants a recognizable accent without breaking the cool-zinc neutral
 * system around them. All hues are saturated enough to read as identity,
 * muted variants are tinted to read as soft brand wash.
 */
export const TENANT_PALETTES: TenantPalette[] = [
  {
    name: 'Coral',
    primary: '#F2693A',
    primaryHover: '#D9501F',
    primaryMuted: '#FDEEE6',
    accent: '#F5A073',
  },
  {
    name: 'Emerald',
    primary: '#0F9D58',
    primaryHover: '#0B7A44',
    primaryMuted: '#E8F8F0',
    accent: '#34D399',
  },
  {
    name: 'Amber',
    primary: '#E89320',
    primaryHover: '#B47114',
    primaryMuted: '#FFF6E0',
    accent: '#F5BD5C',
  },
  {
    name: 'Rose',
    primary: '#E11D48',
    primaryHover: '#BE123C',
    primaryMuted: '#FCE9EB',
    accent: '#FB7185',
  },
  {
    name: 'Violet',
    primary: '#7C3AED',
    primaryHover: '#6D28D9',
    primaryMuted: '#EDE9FE',
    accent: '#A78BFA',
  },
  {
    name: 'Slate',
    primary: '#475569',
    primaryHover: '#334155',
    primaryMuted: '#F1F5F9',
    accent: '#94A3B8',
  },
  {
    name: 'Sky',
    primary: '#0EA5E9',
    primaryHover: '#0284C7',
    primaryMuted: '#E0F2FE',
    accent: '#38BDF8',
  },
  {
    name: 'Indigo',
    primary: '#4F46E5',
    primaryHover: '#3730A3',
    primaryMuted: '#EEF2FF',
    accent: '#818CF8',
  },
  {
    name: 'Teal',
    primary: '#0D9488',
    primaryHover: '#0F766E',
    primaryMuted: '#CCFBF1',
    accent: '#2DD4BF',
  },
  {
    name: 'Fuchsia',
    primary: '#C026D3',
    primaryHover: '#A21CAF',
    primaryMuted: '#FAE8FF',
    accent: '#E879F9',
  },
  {
    name: 'Bronze',
    primary: '#A16207',
    primaryHover: '#854D0E',
    primaryMuted: '#FEF3C7',
    accent: '#CA8A04',
  },
  {
    name: 'Forest',
    primary: '#166534',
    primaryHover: '#14532D',
    primaryMuted: '#DCFCE7',
    accent: '#22C55E',
  },
];
