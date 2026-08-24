'use client';

import { useState } from 'react';
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/shared/utils/cn';

/**
 * A price field the cashier can actually type cents into.
 *
 * A plain `<Input type="number" value={someNumber}>` cannot: the moment
 * you type the separator in "4.25", `Number('4.')` is `4`, the re-render
 * paints "4", and the point you just typed is gone. You never reach the
 * decimals. So the keystrokes live here as a string draft and only the
 * parsed number leaves through onChange.
 *
 * `type="text"` + `inputMode="decimal"` rather than `type="number"`: a
 * number input rejects the in-progress "4." as a value, and its scroll
 * wheel silently rewrites prices when the cashier scrolls the ticket.
 */
interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  'aria-label'?: string;
}

// Up to two decimals, comma or point — the counter keypad sends either.
// A bare separator ("4.") is allowed *while typing*; it parses to 4.
const DRAFT = /^\d*(?:[.,]\d{0,2})?$/;

export function MoneyInput({
  value,
  onChange,
  disabled,
  title,
  className,
  'aria-label': ariaLabel,
}: MoneyInputProps) {
  // null = not being edited, so the prop is the truth. Set only while
  // the cashier is mid-keystroke, which is what lets "4." survive.
  const [draft, setDraft] = useState<string | null>(null);

  function handleChange(raw: string) {
    if (raw !== '' && !DRAFT.test(raw)) return;

    setDraft(raw);

    const parsed = raw === '' ? 0 : Number(raw.replace(',', '.'));
    if (!Number.isNaN(parsed)) onChange(parsed);
  }

  // Once the cashier is done, the field settles on the same shape the
  // rest of the counter prints: whole dollars bare, cents always two.
  // While typing the draft rules, so "3.5" is not snapped mid-keystroke.
  const settled = Number.isInteger(value) ? String(value) : value.toFixed(2);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft ?? settled}
      disabled={disabled}
      title={title}
      // Correcting a price is retyping it, not editing it digit by digit —
      // without this the cashier backspaces "20" into "2" and types 4.25
      // onto the leftover, landing on 24.25.
      onFocus={(e) => e.currentTarget.select()}
      // Dropping the draft snaps the field to the canonical number, so a
      // trailing separator or a leading zero doesn't linger on screen.
      onBlur={() => setDraft(null)}
      onChange={(e) => handleChange(e.target.value)}
      className={cn('text-right font-mono tabular-nums', className)}
      style={{ fontFamily: 'var(--font-mono)' }}
      aria-label={ariaLabel}
    />
  );
}
