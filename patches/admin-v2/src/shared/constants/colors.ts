export interface TenantPalette {
  name: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  accent: string;
}

/**
 * Curated set of 6 tenant palettes (down from 12).
 * Coral is the Turnly brand default; the others give tenants a recognizable
 * accent without breaking the cool-zinc neutral system around them.
 *
 * Source: Turnly Design System (preview/colors-tenant.html)
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
];
