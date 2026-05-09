'use client';

import { Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/infrastructure/api/client';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatCurrency } from '@/shared/utils/format';

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  max_services: number | null;
  max_reservations_per_month: number | null;
  max_employees: number | null;
  has_push_notifications: boolean;
  has_reports: boolean;
  has_reminders: boolean;
  has_custom_page: boolean;
  is_active: boolean;
}

interface TenantPlanResponse {
  data: {
    current: Plan | null;
    is_trial: boolean;
    trial_ends_at: string | null;
    usage: {
      services: number;
      reservations_this_month: number;
      employees: number;
    };
    available: Plan[];
  };
}

function formatLimit(value: number | null): React.ReactNode {
  if (value === null) return <InfinityIcon className="inline h-4 w-4" aria-label="Ilimitado" />;
  return value;
}

function priceLabel(p: number): string {
  return p === 0 ? 'Gratis' : formatCurrency(p, { decimals: true });
}

function UsageBlock({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const danger = !isUnlimited && used >= limit;
  const warning = !isUnlimited && pct > 75 && !danger;

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[20px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {used}
        </span>
        <span className="text-[13px] text-[var(--fg-secondary)]">
          {isUnlimited ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">de</span>
              <InfinityIcon className="h-3.5 w-3.5" aria-label="ilimitado" />
            </span>
          ) : (
            <>
              <span aria-hidden="true">/</span>{' '}
              <span
                className="tabular-nums"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {limit}
              </span>
            </>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              danger
                ? 'bg-[var(--status-cancelled-fg)]'
                : warning
                  ? 'bg-[var(--warning-500)]'
                  : 'bg-[var(--success-500)]'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {enabled ? (
        <Check className="h-4 w-4 shrink-0 text-[var(--status-completed-fg)]" aria-hidden="true" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
      )}
      <span className={enabled ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)] line-through decoration-1'}>
        {label}
      </span>
    </li>
  );
}

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  currentPrice: number;
  onSelect: (plan: Plan) => void;
  isPending: boolean;
}

function PlanCard({ plan, isCurrent, currentPrice, onSelect, isPending }: PlanCardProps) {
  const isUpgrade = plan.price > currentPrice;
  const isDowngrade = plan.price < currentPrice;

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border bg-[var(--bg-surface)] p-5 transition-shadow hover:shadow-sm',
        isCurrent
          ? 'border-[var(--brand-500)] ring-2 ring-[var(--brand-500)]/15'
          : 'border-[var(--border)]'
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold leading-tight text-[var(--fg-strong)]">
            {plan.name}
          </h3>
          {plan.description && (
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--fg-secondary)]">
              {plan.description}
            </p>
          )}
        </div>
        {isCurrent && (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--brand-50)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--brand-700)]">
            Actual
          </span>
        )}
      </header>

      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[28px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {priceLabel(plan.price)}
        </span>
        {plan.price > 0 && (
          <span className="text-[12px] text-[var(--fg-muted)]">/mes</span>
        )}
      </div>

      <ul className="mt-5 space-y-2 text-[13px] text-[var(--fg)]">
        <li className="flex items-center justify-between">
          <span className="text-[var(--fg-secondary)]">Servicios</span>
          <span className="font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatLimit(plan.max_services)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-[var(--fg-secondary)]">Reservas/mes</span>
          <span className="font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatLimit(plan.max_reservations_per_month)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-[var(--fg-secondary)]">Empleados</span>
          <span className="font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatLimit(plan.max_employees)}
          </span>
        </li>
      </ul>

      <div className="my-4 h-px bg-[var(--border)]" />

      <ul className="space-y-2">
        <FeatureRow label="Notificaciones push" enabled={plan.has_push_notifications} />
        <FeatureRow label="Reportes" enabled={plan.has_reports} />
        <FeatureRow label="Recordatorios" enabled={plan.has_reminders} />
        <FeatureRow label="Página pública" enabled={plan.has_custom_page} />
      </ul>

      <div className="mt-5 pt-1">
        <Button
          variant={isUpgrade && !isCurrent ? 'default' : 'outline'}
          size="sm"
          disabled={isCurrent || isPending}
          onClick={() => onSelect(plan)}
          className="w-full"
        >
          {isCurrent
            ? 'Plan actual'
            : isUpgrade
              ? 'Subir a este plan'
              : isDowngrade
                ? 'Bajar a este plan'
                : 'Cambiar a este plan'}
        </Button>
      </div>
    </article>
  );
}

function PlanContent() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: async () => {
      const { data } = await api.get<TenantPlanResponse>('/tenant/plan');
      return data.data;
    },
  });

  const changePlan = useMutation({
    mutationFn: async (planId: string) => {
      await api.post('/tenant/plan/change', { plan_id: planId });
    },
    onSuccess: () => {
      toast.success('Plan actualizado');
      queryClient.invalidateQueries({ queryKey: ['tenant', 'plan'] });
    },
    onError: () => toast.error('No se pudo cambiar el plan'),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { current, is_trial, trial_ends_at, usage, available } = data;
  const currentPrice = current?.price ?? 0;

  return (
    <div className="space-y-5">
      {is_trial && trial_ends_at && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-[var(--warning-500)]/30 bg-[var(--warning-50)] p-4"
        >
          <Sparkles
            className="h-5 w-5 shrink-0 text-[var(--warning-700)]"
            aria-hidden="true"
          />
          <div className="text-[13px]">
            <p className="font-semibold text-[var(--warning-700)]">Periodo de prueba activo</p>
            <p className="text-[var(--warning-700)]/80">
              Termina el{' '}
              <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {new Date(trial_ends_at).toLocaleDateString('es-EC', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
        </div>
      )}

      {current && (
        <section
          aria-label="Plan actual"
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Plan actual
              </p>
              <h2
                className="mt-2 text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
                style={{ fontFamily: 'var(--font-display)', fontStretch: '90%', letterSpacing: '-0.01em' }}
              >
                {current.name}
              </h2>
            </div>
            <div className="shrink-0 text-right">
              <p
                className="text-[28px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {priceLabel(current.price)}
              </p>
              {current.price > 0 && (
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">/mes</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <UsageBlock
              label="Servicios"
              used={usage.services}
              limit={current.max_services}
            />
            <UsageBlock
              label="Reservas este mes"
              used={usage.reservations_this_month}
              limit={current.max_reservations_per_month}
            />
            <UsageBlock
              label="Empleados"
              used={usage.employees}
              limit={current.max_employees}
            />
          </div>
        </section>
      )}

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-[var(--fg-strong)]">
          Planes disponibles
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {available.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={current?.id === plan.id}
              currentPrice={currentPrice}
              onSelect={(p) => {
                if (confirm(`¿Cambiar a "${p.name}" (${priceLabel(p.price)}${p.price > 0 ? '/mes' : ''})?`)) {
                  changePlan.mutate(p.id);
                }
              }}
              isPending={changePlan.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <PlanContent />
    </Suspense>
  );
}
