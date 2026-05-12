'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useReservations } from '@/presentation/hooks/use-reservations';
import { RESERVATION_STATUS_CONFIG } from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UpcomingReservations() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading } = useReservations({
    dateFrom: today,
    dateTo: today,
  });

  const router = useRouter();

  const reservations = useMemo(
    () =>
      (data?.data ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        ),
    [data]
  );

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
        <div>
          <div className="text-[13px] font-semibold text-[var(--fg-strong)]">
            Agenda de hoy
          </div>
          <div className="text-[11.5px] text-[var(--fg-secondary)]">
            {isLoading
              ? 'Cargando…'
              : `${reservations.length} reservas programadas`}
          </div>
        </div>
        <Link
          href="/reservations"
          className="text-[12.5px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-strong)]"
        >
          Ver calendario →
        </Link>
      </div>

      <div>
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--fg-muted)]">
            Sin reservas pendientes hoy
          </div>
        ) : (
          reservations.map((res) => {
            const statusCfg = RESERVATION_STATUS_CONFIG[res.status];
            const start = format(new Date(res.scheduledAt), 'HH:mm');
            const end = format(new Date(res.estimatedEnd), 'HH:mm');
            const customer = res.client?.name ?? 'Cliente';

            return (
              <button
                key={res.id}
                onClick={() => router.push('/reservations')}
                className="flex w-full items-center gap-3.5 border-b border-[var(--border)] px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--bg-sunken)]"
              >
                <div
                  className="w-[78px] shrink-0 text-[12.5px] font-medium text-[var(--fg-strong)] tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {start}
                  <span className="text-[var(--fg-muted)]">—{end}</span>
                </div>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-[var(--ink-100)] text-[10px] font-semibold text-[var(--fg)]">
                    {getInitials(customer)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[var(--fg-strong)]">
                    {customer}
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--fg-secondary)]">
                    {res.service?.name ?? 'Servicio'}
                  </div>
                </div>
                <Badge
                  className={cn(
                    'shrink-0 border-0 text-[11px] font-semibold',
                    statusCfg.bgColor,
                    statusCfg.color
                  )}
                >
                  <span
                    className={cn(
                      'mr-1 inline-block h-1.5 w-1.5 rounded-full',
                      statusCfg.dotColor
                    )}
                  />
                  {statusCfg.label}
                </Badge>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--fg-muted)]" />
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}
