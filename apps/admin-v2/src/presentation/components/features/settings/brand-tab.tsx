'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { TENANT_PALETTES, type TenantPalette } from '@/shared/constants/colors';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';
import { applyBrandPalette } from '@/presentation/components/layout/brand-theme-provider';
import { Button } from '@/presentation/components/ui/button';
import api from '@/infrastructure/api/client';

/**
 * La misma regla que aplica el backend en `PlanLimitsService::hasFeature`:
 * durante el trial todo está abierto, después manda el plan. Sin esto, un
 * negocio en plan Gratis imprimiría cien carteles con un QR que lleva a un 404.
 */
function useHasPublicPage() {
  return useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/plan');
      return data.data;
    },
    select: (plan: {
      current: { has_custom_page: boolean } | null;
      is_trial: boolean;
      trial_ends_at: string | null;
    }) => {
      const trialActive =
        plan.is_trial && !!plan.trial_ends_at && new Date(plan.trial_ends_at) > new Date();
      return trialActive || !!plan.current?.has_custom_page;
    },
  });
}

export function BrandTab() {
  const { data: settings, isLoading } = useSettings();
  const { data: hasPublicPage } = useHasPublicPage();
  const update = useUpdateSettings();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.themeColor) {
      setSelected(settings.themeColor);
    }
  }, [settings]);

  async function handleSelect(palette: TenantPalette) {
    const previous = selected;
    setSelected(palette.primary);
    applyBrandPalette(palette);
    try {
      await update.mutateAsync({ themeColor: palette.primary });
      toast.success(`Paleta "${palette.name}" aplicada`);
    } catch {
      setSelected(previous);
      const fallback =
        TENANT_PALETTES.find((p) => p.primary === previous) ?? TENANT_PALETTES[0];
      applyBrandPalette(fallback);
      toast.error('Error al cambiar paleta');
    }
  }

  const activePalette = TENANT_PALETTES.find((p) => p.primary === selected) ?? TENANT_PALETTES[0];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Palette grid */}
      <div>
        <p className="mb-3 text-sm text-[var(--fg-muted)]">
          Elige la paleta de tu negocio. Aplica al instante en sidebar y botones.
        </p>
        <div
          role="radiogroup"
          aria-label="Paleta de marca"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {TENANT_PALETTES.map((palette) => {
            const isActive = palette.primary === selected;
            return (
              <button
                key={palette.name}
                role="radio"
                aria-checked={isActive}
                aria-label={`Paleta ${palette.name}`}
                onClick={() => handleSelect(palette)}
                className={cn(
                  'group relative flex flex-col items-center gap-2.5 rounded-xl border bg-white p-4 transition-[transform,box-shadow,border-color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(42,109,244,0.20)] focus-visible:ring-offset-2',
                  isActive
                    ? 'border-[var(--color-primary)] shadow-[0_4px_12px_-2px_rgba(15,18,26,0.08),0_2px_4px_-2px_rgba(15,18,26,0.04)]'
                    : 'border-[var(--border-soft)] hover:border-[var(--border-firm,#D6DAE0)] hover:shadow-[0_1px_2px_0_rgba(15,18,26,0.05)]'
                )}
              >
                {isActive && (
                  <div
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: palette.primary }}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </div>
                )}
                <div className="flex gap-1">
                  <div className="h-8 w-8 rounded-full ring-1 ring-inset ring-black/5" style={{ backgroundColor: palette.primary }} />
                  <div className="h-8 w-8 rounded-full ring-1 ring-inset ring-black/5" style={{ backgroundColor: palette.accent }} />
                  <div className="h-8 w-8 rounded-full ring-1 ring-inset ring-black/5" style={{ backgroundColor: palette.primaryMuted }} />
                </div>
                <span className="text-[13px] font-medium text-[var(--fg-default,#2E3441)]">{palette.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold">Vista previa</CardTitle>
          <p className="text-xs text-[var(--fg-muted)]">Cómo se verá la paleta en tu shell.</p>
        </CardHeader>
        <CardContent>
          <div className="flex overflow-hidden rounded-xl border border-[var(--border-soft)]" style={{ height: 220 }}>
            {/* Mini sidebar */}
            <div className="w-44 border-r border-[var(--border-soft)] bg-white p-3">
              <div
                className="mb-3 flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: activePalette.primary }}
              >
                T
              </div>
              {['Hoy', 'Reservas', 'Servicios'].map((item, i) => (
                <div
                  key={item}
                  className={cn(
                    'mb-1 rounded-md px-2 py-1.5 text-[12px] transition-colors duration-150',
                    i === 0 ? 'font-medium' : 'text-[var(--fg-muted)]'
                  )}
                  style={i === 0 ? { backgroundColor: activePalette.primaryMuted, color: activePalette.primary } : {}}
                >
                  {item}
                </div>
              ))}
            </div>
            {/* Mini content */}
            <div className="flex-1 bg-[var(--niebla-clara,#F4F5F7)] p-3">
              <div className="mb-2 h-3 w-24 rounded bg-[var(--border-soft)]" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-md border border-[var(--border-soft)] bg-white p-2">
                    <div className="mb-1 h-2 w-12 rounded" style={{ backgroundColor: activePalette.primaryMuted }} />
                    <div className="h-3 w-8 rounded" style={{ backgroundColor: activePalette.accent }} />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div
                  className="inline-block rounded-md px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: activePalette.primary }}
                >
                  Botón
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
            Cartel para el mostrador
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasPublicPage === false ? (
            <p className="text-[13px] text-[var(--fg-secondary)]">
              Tu plan actual no incluye página pública, así que el código no
              llevaría a ningún lado. Cambia de plan para poder imprimirlo.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-[var(--fg-secondary)]">
                Una hoja A4 con tu logo y un código QR. Quien lo escanee llega
                directo a reservar contigo.
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link href="/settings/cartel">Ver el cartel</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
