'use client';

import { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Calendar } from '@/presentation/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import { cn } from '@/shared/utils/cn';

type Preset = 'today' | 'week' | 'month' | 'last_month' | 'custom';

interface RangeSelectorProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes pasado' },
  { key: 'custom', label: 'Personalizado' },
];

function getPresetRange(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (preset) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case 'week':
      return { from: fmt(startOfWeek(today, { locale: es })), to: fmt(endOfWeek(today, { locale: es })) };
    case 'month':
      return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
    case 'last_month': {
      const prev = subMonths(today, 1);
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) };
    }
  }
}

function detectPreset(from: string, to: string): Preset {
  for (const key of ['today', 'week', 'month', 'last_month'] as const) {
    const range = getPresetRange(key);
    if (range.from === from && range.to === to) return key;
  }
  return 'custom';
}

export function RangeSelector({ from, to, onChange }: RangeSelectorProps) {
  const activePreset = detectPreset(from, to);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(from ? new Date(from) : undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(to ? new Date(to) : undefined);

  function handlePreset(preset: Preset) {
    if (preset === 'custom') {
      setCustomOpen(true);
      return;
    }
    const range = getPresetRange(preset);
    onChange(range.from, range.to);
  }

  function applyCustom() {
    if (customFrom && customTo) {
      onChange(format(customFrom, 'yyyy-MM-dd'), format(customTo, 'yyyy-MM-dd'));
      setCustomOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(({ key, label }) => {
        const active = activePreset === key;
        const baseCls = cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          active
            ? 'border-transparent bg-[var(--ink-700)] text-[var(--bg-surface)]'
            : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg)] hover:border-[var(--border-strong)]'
        );
        if (key === 'custom') {
          return (
            <Popover key={key} open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <button type="button" aria-pressed={active} className={baseCls}>
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {active ? `${from} — ${to}` : label}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="flex gap-4">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Desde</p>
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} locale={es} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Hasta</p>
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} locale={es} />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={applyCustom} disabled={!customFrom || !customTo}>
                    Aplicar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            className={baseCls}
            onClick={() => handlePreset(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
