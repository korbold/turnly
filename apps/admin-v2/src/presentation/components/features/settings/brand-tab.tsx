'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { TENANT_PALETTES, type TenantPalette } from '@/shared/constants/colors';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';

export function BrandTab() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.themeColor) {
      setSelected(settings.themeColor);
    }
  }, [settings]);

  async function handleSelect(palette: TenantPalette) {
    setSelected(palette.primary);
    try {
      await update.mutateAsync({ themeColor: palette.primary });
      toast.success(`Paleta "${palette.name}" aplicada`);
    } catch {
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
        <p className="mb-3 text-sm text-muted-foreground">
          Selecciona una paleta de colores para tu negocio
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TENANT_PALETTES.map((palette) => {
            const isActive = palette.primary === selected;
            return (
              <button
                key={palette.name}
                onClick={() => handleSelect(palette)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                  isActive
                    ? 'border-zinc-900 shadow-md'
                    : 'border-transparent bg-white shadow-sm hover:shadow-md'
                )}
              >
                {isActive && (
                  <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div className="flex gap-1">
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: palette.primary }} />
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: palette.accent }} />
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: palette.primaryMuted }} />
                </div>
                <span className="text-xs font-medium">{palette.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Vista Previa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex overflow-hidden rounded-lg border" style={{ height: 200 }}>
            {/* Mini sidebar */}
            <div className="w-44 border-r bg-white p-3">
              <div
                className="mb-3 flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: activePalette.primary }}
              >
                T
              </div>
              {['Dashboard', 'Reservas', 'Servicios'].map((item, i) => (
                <div
                  key={item}
                  className={cn('mb-1 rounded-md px-2 py-1.5 text-xs', i === 0 ? 'font-medium' : 'text-zinc-500')}
                  style={i === 0 ? { backgroundColor: activePalette.primaryMuted, color: activePalette.primary } : {}}
                >
                  {item}
                </div>
              ))}
            </div>
            {/* Mini content */}
            <div className="flex-1 bg-zinc-50 p-3">
              <div className="mb-2 h-3 w-24 rounded bg-zinc-200" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-md border bg-white p-2">
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
                  Boton
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
