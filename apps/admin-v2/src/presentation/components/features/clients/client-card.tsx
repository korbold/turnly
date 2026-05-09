'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import type { ClientResource } from '@/domain/entities/client-resource';

interface ClientCardProps {
  client: ClientResource;
  index?: number;
}

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

function pickPhone(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  for (const key of Object.keys(data)) {
    if (/(tel|phone|cel|whats)/i.test(key)) {
      const v = data[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

function isSyntheticEmail(email: string | undefined | null): boolean {
  return !!email && /@client\.local$/i.test(email);
}

export function ClientCard({ client, index = 0 }: ClientCardProps) {
  const hasPlate = !!client.plate;
  const clientName = client.client?.name ?? null;
  const primary = hasPlate ? client.plate! : clientName ?? client.label ?? 'Sin identificar';
  const vehicleInfo = [client.brand, client.model, client.color].filter(Boolean).join(' · ');
  const phone = pickPhone(client.data);
  const realEmail = !isSyntheticEmail(client.client?.email) ? client.client?.email : null;

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
        </div>
        {secondary && (
          <p className="truncate text-[12.5px] text-[var(--fg-secondary)]">
            {secondary}
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
