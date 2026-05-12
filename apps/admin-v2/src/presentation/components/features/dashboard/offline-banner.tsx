'use client';

import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  lastUpdated?: Date | null;
}

function timeAgo(date: Date, now: Date): string {
  const diffMin = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  return `hace ${hours} h`;
}

export function OfflineBanner({ isOnline, lastUpdated }: OfflineBannerProps) {
  if (isOnline) return null;

  const note = lastUpdated
    ? `Mostrando agenda guardada ${timeAgo(lastUpdated, new Date())}.`
    : 'Mostrando agenda guardada.';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] px-3.5 py-2.5"
    >
      <WifiOff
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-secondary)]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--fg-strong)]">
          Sin conexión.
        </p>
        <p className="text-[12.5px] text-[var(--fg-secondary)]">{note}</p>
      </div>
    </div>
  );
}
