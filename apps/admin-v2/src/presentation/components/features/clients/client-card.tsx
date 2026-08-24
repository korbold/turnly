'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Star, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import { formatCounterCurrency } from '@/shared/utils/format';
import {
  clientNameOf,
  contactEmailOf,
  phoneOf,
  plateOf,
  vehicleInfoOf,
} from '@/shared/utils/client-resource';
import type { ClientResource } from '@/domain/entities/client-resource';

interface ClientCardProps {
  client: ClientResource;
  index?: number;
}

// El formateador de la app: `es-EC` imprime la coma como decimal, que para el
// dólar en Ecuador está mal (ver `shared/utils/format.ts`). El chip de deuda
// decía "$587,68" al lado de un registro que dice "$587.68".
const money = (v: number) => formatCounterCurrency(v);

function getInitials(text: string | null | undefined): string {
  if (!text) return '?';
  return text
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ClientCard({ client, index = 0 }: ClientCardProps) {
  const plate = plateOf(client);
  const hasPlate = !!plate;
  const clientName = clientNameOf(client);
  const primary = hasPlate ? plate : clientName ?? client.label ?? 'Sin identificar';
  const vehicleInfo = vehicleInfoOf(client).join(' · ');
  const phone = phoneOf(client);
  const realEmail = contactEmailOf(client);

  const secondary = hasPlate
    ? clientName ?? (vehicleInfo || phone || realEmail || null)
    : phone || realEmail || vehicleInfo || null;

  const visits = (client.data as Record<string, unknown> | null)?.totalVisits;
  const lastVisit = (client.data as Record<string, unknown> | null)?.lastVisit;
  const isFrequent = typeof visits === 'number' && visits > 10;

  return (
    <Link
      href={`/clients/${client.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="group flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in-0 slide-in-from-bottom-2 [animation-fill-mode:both] [animation-duration:260ms] [animation-timing-function:var(--ease-out)]"
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-[var(--ink-75)] text-[12px] font-semibold text-[var(--fg-strong)]">
          {getInitials(clientName ?? primary)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold leading-snug text-[var(--fg-strong)]">
            {primary}
          </p>
          {isFrequent && (
            <Star
              className="h-3.5 w-3.5 shrink-0 text-[var(--warning-500)]"
              fill="currentColor"
              aria-label="Cliente frecuente"
            />
          )}
          {/* La deuda va junto al nombre, no al final de la fila: es lo
              primero que el dueño busca el lunes a la mañana. */}
          {client.debt > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
              <Wallet className="h-3 w-3" aria-hidden="true" />
              debe {money(client.debt)}
            </span>
          )}
        </div>
        {clientName ? (
          secondary && (
            <p className="truncate text-[12.5px] text-[var(--fg-secondary)]">{secondary}</p>
          )
        ) : (
          // Unowned walk-in: the counter never captured a name. Say so
          // plainly and point at the fix instead of leaving a blank line.
          <p className="flex items-center gap-1.5 truncate text-[12.5px] text-[var(--fg-secondary)]">
            <span className="rounded-full bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--fg-muted)]">
              Sin cliente
            </span>
            <span className="truncate">Toca para asignar nombre</span>
          </p>
        )}
      </div>

      {(typeof visits === 'number' || typeof lastVisit === 'string') && (
        <div className="hidden flex-col items-end gap-0.5 text-right text-[11px] text-[var(--fg-muted)] sm:flex">
          {typeof visits === 'number' && (
            <span className="tabular-nums">
              {visits} {visits === 1 ? 'visita' : 'visitas'}
            </span>
          )}
          {typeof lastVisit === 'string' && lastVisit && (
            <span>
              Hace {formatDistanceToNow(new Date(lastVisit), { locale: es })}
            </span>
          )}
        </div>
      )}

      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
