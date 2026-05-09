'use client';

import { useEffect } from 'react';
import { TENANT_PALETTES, type TenantPalette } from '@/shared/constants/colors';
import { useSettings } from '@/presentation/hooks/use-settings';

const DEFAULT_PALETTE = TENANT_PALETTES[0];

function findPalette(primary: string | null | undefined): TenantPalette {
  if (!primary) return DEFAULT_PALETTE;
  return (
    TENANT_PALETTES.find(
      (p) => p.primary.toLowerCase() === primary.toLowerCase(),
    ) ?? DEFAULT_PALETTE
  );
}

export function applyBrandPalette(palette: TenantPalette) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-primary-hover', palette.primaryHover);
  root.style.setProperty('--color-primary-muted', palette.primaryMuted);
  root.style.setProperty('--primary', palette.primary);
  root.style.setProperty('--primary-hover', palette.primaryHover);
  root.style.setProperty('--primary-soft', palette.primaryMuted);
  root.style.setProperty('--brand-500', palette.primary);
  root.style.setProperty('--brand-600', palette.primaryHover);
  root.style.setProperty('--brand-50', palette.primaryMuted);
  root.style.setProperty('--brand-700', palette.primaryHover);
  root.style.setProperty('--border-brand', palette.primary);
}

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();

  useEffect(() => {
    if (!settings) return;
    const palette = findPalette(settings.themeColor);
    applyBrandPalette(palette);
  }, [settings?.themeColor]);

  return <>{children}</>;
}
