'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import type { Bank } from '@/shared/constants/banks';

interface BankChipProps {
  bank: Bank;
  size?: number;
  className?: string;
}

/**
 * Renders the bank's official logo when one ships under `public/banks/`,
 * otherwise falls back to a brand-colored chip with the bank's initials.
 * The fallback fires both when there is no `logoUrl` on the bank record
 * and when the image fails to load at runtime (404, blocked, etc.).
 */
export function BankChip({ bank, size = 28, className }: BankChipProps) {
  const [errored, setErrored] = useState(false);
  const showLogo = bank.logoUrl && !errored;

  if (showLogo) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-[var(--border)] p-0.5',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* Plain <img>: the assets are static SVGs in /public, and we
            need the onError fallback which next/image doesn't expose
            with the same UX. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bank.logoUrl!}
          alt={bank.name}
          className="h-full w-full object-contain"
          onError={() => setErrored(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-tight',
        className,
      )}
      style={{ width: size, height: size, backgroundColor: bank.color, color: bank.fg }}
      aria-hidden="true"
    >
      {bank.initials}
    </span>
  );
}
