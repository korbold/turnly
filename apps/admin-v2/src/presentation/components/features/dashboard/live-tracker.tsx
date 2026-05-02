'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useServiceLogs, useCompleteServiceLog } from '@/presentation/hooks/use-service-logs';
import { toast } from 'sonner';
import type { ServiceLog } from '@/domain/entities/service-log';

const ESTIMATED_MIN = 30;

function elapsedMinutes(startedAt: Date | string): number {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function StationCard({
  log,
  onComplete,
  isCompleting,
}: {
  log: ServiceLog;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const elapsed = elapsedMinutes(log.startedAt);
  const remaining = Math.max(0, ESTIMATED_MIN - elapsed);
  const pct = Math.min(100, Math.round((elapsed / ESTIMATED_MIN) * 100));
  const startedHHMM = format(new Date(log.startedAt), 'HH:mm');

  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] rounded-full bg-[var(--brand-500)]" />
          <span className="text-[11.5px] font-semibold text-[var(--fg)]">
            {log.clientResource?.plate ?? 'Sin placa'}
          </span>
        </div>
        <span
          className="text-[10.5px] text-[var(--fg-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {remaining} min restantes
        </span>
      </div>
      <div className="text-[13px] font-semibold text-[var(--fg-strong)]">
        {log.service?.name ?? 'Servicio'}
      </div>
      {log.attendant?.name && (
        <div className="text-[11.5px] text-[var(--fg-secondary)]">
          {log.attendant.name}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--ink-100)]">
          <div
            className="h-full rounded-full bg-[var(--brand-500)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className="text-[10px] text-[var(--fg-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {startedHHMM}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="mt-1 h-7 justify-start px-2 text-[11.5px] text-[var(--success-700)] hover:bg-[var(--success-50)]"
        onClick={onComplete}
        disabled={isCompleting}
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Completar
      </Button>
    </div>
  );
}

export function LiveTracker() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading } = useServiceLogs({ date: today });
  const completeMutation = useCompleteServiceLog();

  const inProgress = useMemo(
    () => (data?.data ?? []).filter((l) => l.status === 'in_progress'),
    [data]
  );

  function handleComplete(id: string) {
    completeMutation.mutate(id, {
      onSuccess: () => toast.success('Servicio completado'),
      onError: () => toast.error('Error al completar el servicio'),
    });
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
        <div>
          <div className="text-[13px] font-semibold text-[var(--fg-strong)]">
            Estaciones en tiempo real
          </div>
          <div className="text-[11.5px] text-[var(--fg-secondary)]">
            {isLoading
              ? 'Cargando…'
              : `${inProgress.length} ocupadas`}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--success-700)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success-500)]" />
          EN VIVO
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5 p-3.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 min-w-[200px] flex-1 rounded-[10px]" />
          ))
        ) : inProgress.length === 0 ? (
          <div className="flex w-full items-center justify-center py-6 text-[13px] text-[var(--fg-muted)]">
            Sin servicios en progreso
          </div>
        ) : (
          inProgress.map((log) => (
            <StationCard
              key={log.id}
              log={log}
              onComplete={() => handleComplete(log.id)}
              isCompleting={completeMutation.isPending}
            />
          ))
        )}
      </div>
    </Card>
  );
}
