'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Check, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useServices } from '@/presentation/hooks/use-services';

const STORAGE_KEY = 'turnly_onboarding_dismissed';

interface OnboardingStep {
  key: string;
  label: string;
  href: string;
  check: (ctx: StepContext) => boolean;
}

interface StepContext {
  hasName: boolean;
  hasService: boolean;
  hasSchedule: boolean;
  hasLogo: boolean;
  hasReservation: boolean;
}

const STEPS: OnboardingStep[] = [
  { key: 'account', label: 'Crear cuenta', href: '#', check: () => true },
  { key: 'name', label: 'Nombre negocio', href: '/settings?tab=general', check: (ctx) => ctx.hasName },
  { key: 'service', label: 'Primer servicio', href: '/services', check: (ctx) => ctx.hasService },
  { key: 'schedule', label: 'Configura horario', href: '/settings?tab=schedule', check: (ctx) => ctx.hasSchedule },
  { key: 'logo', label: 'Sube logo', href: '/settings?tab=general', check: (ctx) => ctx.hasLogo },
  { key: 'reservation', label: 'Primera reserva', href: '/reservations?create=true', check: (ctx) => ctx.hasReservation },
];

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(true);
  const { data: settings } = useSettings();
  const { data: servicesData } = useServices();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === 'true');
  }, []);

  const services = servicesData?.data ?? [];

  const ctx: StepContext = {
    hasName: !!settings?.name,
    hasService: services.length > 0,
    hasSchedule: true, // Account creation implies some schedule
    hasLogo: !!settings?.logoUrl,
    hasReservation: false, // We don't have a simple way to check this without a dedicated query
  };

  const completed = STEPS.filter((s) => s.check(ctx)).length;
  const total = STEPS.length;
  const allDone = completed === total;

  if (dismissed || allDone) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }

  const progress = (completed / total) * 100;

  return (
    <Card className="border-[var(--color-primary)]/20 bg-[var(--color-primary-muted)]/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configura tu negocio</h3>
            <p className="mt-0.5 text-xs text-[var(--color-primary-hover)]/70">
              {completed} de {total} pasos completados
            </p>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-200">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Steps */}
            <div className="mt-3 space-y-1">
              {STEPS.map((step) => {
                const done = step.check(ctx);
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full',
                        done ? 'bg-[var(--color-primary)] text-white' : 'border border-[var(--color-primary)]/40'
                      )}
                    >
                      {done && <Check className="h-2.5 w-2.5" />}
                    </div>
                    {done ? (
                      <span className="text-xs text-[var(--color-primary-hover)] line-through">{step.label}</span>
                    ) : (
                      <Link
                        href={step.href}
                        className="flex items-center gap-0.5 text-xs font-medium text-[var(--color-primary-hover)] hover:underline"
                      >
                        {step.label}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button variant="ghost" size="sm" className="text-[var(--color-primary)]" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-2">
          <button onClick={handleDismiss} className="text-xs text-[var(--color-primary)]/60 hover:underline">
            Omitir
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
