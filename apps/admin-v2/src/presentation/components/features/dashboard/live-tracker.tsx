'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Timer, CheckCircle2, Droplets } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useServiceLogs, useCompleteServiceLog } from '@/presentation/hooks/use-service-logs';
import { toast } from 'sonner';
import type { ServiceLog } from '@/domain/entities/service-log';

function ElapsedTime({ startedAt }: { startedAt: Date }) {
  const elapsed = useMemo(() => {
    const diffMs = Date.now() - new Date(startedAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }, [startedAt]);

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Timer className="h-3 w-3" />
      {elapsed}min
    </span>
  );
}

function ProgressBar({
  startedAt,
  estimatedMinutes,
}: {
  startedAt: Date;
  estimatedMinutes: number;
}) {
  const pct = useMemo(() => {
    const diffMs = Date.now() - new Date(startedAt).getTime();
    const elapsed = diffMs / 60000;
    return Math.min(100, Math.round((elapsed / estimatedMinutes) * 100));
  }, [startedAt, estimatedMinutes]);

  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TrackerCard({
  log,
  onComplete,
  isCompleting,
}: {
  log: ServiceLog;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {log.clientResource?.plate ?? 'Sin placa'}
          </p>
          <ElapsedTime startedAt={log.startedAt} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {log.service?.name ?? 'Servicio'}
          {log.attendant?.name ? ` - ${log.attendant.name}` : ''}
        </p>
        {/* Rough 30-minute default estimate if no duration configured */}
        <ProgressBar startedAt={log.startedAt} estimatedMinutes={30} />
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="ml-3 shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        onClick={onComplete}
        disabled={isCompleting}
      >
        <CheckCircle2 className="mr-1 h-4 w-4" />
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">En Progreso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplets className="h-4 w-4 text-indigo-500" />
          En Progreso
          {inProgress.length > 0 && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {inProgress.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {inProgress.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Droplets className="mb-2 h-10 w-10 text-zinc-300" />
            <p className="text-sm text-muted-foreground">
              Sin servicios en progreso
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inProgress.map((log) => (
              <TrackerCard
                key={log.id}
                log={log}
                onComplete={() => handleComplete(log.id)}
                isCompleting={completeMutation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
