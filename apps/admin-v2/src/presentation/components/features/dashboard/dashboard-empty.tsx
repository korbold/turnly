'use client';

import Link from 'next/link';
import { ArrowRight, CalendarPlus, Scissors, Share2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface ChecklistStep {
  done: boolean;
  label: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardEmptyProps {
  variant: 'no-services' | 'no-reservations';
  steps?: ChecklistStep[];
  bookingUrl?: string;
  onCreateWalkIn: () => void;
}

export function DashboardEmpty({
  variant,
  steps,
  bookingUrl,
  onCreateWalkIn,
}: DashboardEmptyProps) {
  if (variant === 'no-services') {
    const fallbackSteps: ChecklistStep[] = [
      {
        done: false,
        label: 'Crea tus servicios',
        href: '/services',
        icon: Scissors,
      },
      {
        done: false,
        label: 'Define tu horario',
        href: '/settings',
        icon: CalendarPlus,
      },
      {
        done: false,
        label: 'Comparte tu link de reservas',
        href: '/settings',
        icon: Share2,
      },
    ];
    const list = steps ?? fallbackSteps;

    return (
      <section
        aria-label="Pasos para empezar"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Casi listo
        </p>
        <h2
          className="mt-1 text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
          style={{
            fontFamily: 'var(--font-display)',
            fontStretch: '90%',
            letterSpacing: '-0.01em',
          }}
        >
          Tres pasos para empezar a recibir citas.
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-[var(--fg-secondary)]">
          Una vez completes estos pasos, tu negocio aparecerá en tu dashboard.
        </p>

        <ol className="mt-5 space-y-2">
          {list.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.href + i}
                className="animate-in fade-in-0 slide-in-from-bottom-2 [animation-fill-mode:both] [animation-duration:280ms] [animation-timing-function:var(--ease-out)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Link
                  href={step.href}
                  className="group flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3 transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[12px] font-semibold tabular-nums text-[var(--fg)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <Icon
                    className="h-4 w-4 shrink-0 text-[var(--fg-secondary)]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--fg-strong)]">
                    {step.label}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  return (
    <section
      aria-label="Sin reservas para hoy"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        Hoy
      </p>
      <h2
        className="mt-1 text-[22px] font-bold leading-tight text-[var(--fg-strong)]"
        style={{
          fontFamily: 'var(--font-display)',
          fontStretch: '90%',
          letterSpacing: '-0.01em',
        }}
      >
        Hoy no hay citas todavía.
      </h2>
      <p className="mt-1 text-[14px] leading-snug text-[var(--fg-secondary)]">
        Sigue tu día. Las visitas sin cita también cuentan.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={onCreateWalkIn}>Registrar sin cita</Button>
        {bookingUrl && (
          <Link
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-strong)] focus-visible:outline-none focus-visible:underline"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Comparte tu link
          </Link>
        )}
      </div>
    </section>
  );
}
