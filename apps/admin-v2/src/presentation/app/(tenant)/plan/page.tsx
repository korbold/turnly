'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import api from '@/infrastructure/api/client';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/shared/utils/cn';

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
  if (value === null) return <InfinityIcon className="inline h-4 w-4" />;
  return value;
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const danger = limit !== null && used >= limit;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-500">{used} usado</span>
        <span className={cn('font-medium', danger && 'text-rose-600')}>
          {limit === null ? 'Ilimitado' : `${used} / ${limit}`}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              danger ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-[var(--color-primary)]',
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
    <li className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <X className="h-4 w-4 text-zinc-300" />
      )}
      <span className={cn(enabled ? 'text-zinc-700' : 'text-zinc-400')}>{label}</span>
    </li>
  );
}

function PlanCard({ plan, isCurrent }: { plan: Plan; isCurrent: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-5 shadow-sm transition',
        isCurrent ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-zinc-200',
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
          {plan.description && (
            <p className="mt-1 text-xs text-zinc-500">{plan.description}</p>
          )}
        </div>
        {isCurrent && <Badge className="bg-[var(--color-primary)]">Actual</Badge>}
      </div>

      <div className="mb-4">
        <span className="text-2xl font-bold text-[var(--color-primary)]">
          {plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}
        </span>
        {plan.price > 0 && <span className="ml-1 text-xs text-zinc-500">/mes</span>}
      </div>

      <ul className="space-y-2 text-sm text-zinc-700">
        <li className="flex items-center justify-between">
          <span>Servicios</span>
          <span className="font-medium">{formatLimit(plan.max_services)}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Reservas/mes</span>
          <span className="font-medium">{formatLimit(plan.max_reservations_per_month)}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Empleados</span>
          <span className="font-medium">{formatLimit(plan.max_employees)}</span>
        </li>
      </ul>

      <div className="my-4 h-px bg-zinc-100" />

      <ul className="space-y-2">
        <FeatureRow label="Notificaciones push" enabled={plan.has_push_notifications} />
        <FeatureRow label="Reportes" enabled={plan.has_reports} />
        <FeatureRow label="Recordatorios" enabled={plan.has_reminders} />
        <FeatureRow label="Página pública" enabled={plan.has_custom_page} />
      </ul>
    </div>
  );
}

function PlanContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: async () => {
      const { data } = await api.get<TenantPlanResponse>('/tenant/plan');
      return data.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const { current, is_trial, trial_ends_at, usage, available } = data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          Plan actual, uso del mes y opciones disponibles
        </p>
      </div>

      {is_trial && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Sparkles className="h-5 w-5 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">Periodo de prueba activo</p>
            {trial_ends_at && (
              <p className="text-amber-700">
                Termina el {new Date(trial_ends_at).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {current && (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Plan actual</p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-900">{current.name}</h2>
            </div>
            <span className="text-2xl font-bold text-[var(--color-primary)]">
              {current.price === 0 ? 'Gratis' : `$${current.price.toFixed(2)}`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">Servicios</p>
              <UsageBar used={usage.services} limit={current.max_services} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">Reservas este mes</p>
              <UsageBar
                used={usage.reservations_this_month}
                limit={current.max_reservations_per_month}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">Empleados</p>
              <UsageBar used={usage.employees} limit={current.max_employees} />
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold">Planes disponibles</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {available.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isCurrent={current?.id === plan.id} />
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
