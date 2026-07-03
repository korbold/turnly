'use client';

import { Banknote, CreditCard, ArrowLeftRight, X } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS, findBank } from '@/shared/constants/banks';
import { cn } from '@/shared/utils/cn';

type PaymentMethodFilter = 'cash' | 'card' | 'transfer' | null;

interface Props {
  method: PaymentMethodFilter;
  bank: string | null;
  /** Set of bank slugs that actually have activity in the current
      range, so we don't render 13 chips when 2 banks have data. */
  availableBanks?: string[];
  onMethodChange: (next: PaymentMethodFilter) => void;
  onBankChange: (next: string | null) => void;
}

const METHODS: {
  value: Exclude<PaymentMethodFilter, null>;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
];

/**
 * Two-row filter system shaped to coexist with the range chips above
 * it without competing for attention. Method buttons use a square-ish
 * `rounded-md` so they read as filters (the "qué") instead of time
 * chips (the "cuándo"). Bank slice only appears once the cashier has
 * narrowed to transferencia — keeps the surface honest.
 */
export function MethodFilter({
  method,
  bank,
  availableBanks,
  onMethodChange,
  onBankChange,
}: Props) {
  const banksToShow = availableBanks?.length
    ? ECUADOR_BANKS.filter((b) => availableBanks.includes(b.slug))
    : ECUADOR_BANKS;
  const activeBank = findBank(bank);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
          Método
        </span>
        <FilterButton
          active={method === null}
          onClick={() => {
            onMethodChange(null);
            onBankChange(null);
          }}
          label="Todos"
        />
        {METHODS.map((m) => {
          const Icon = m.icon;
          return (
            <FilterButton
              key={m.value}
              active={method === m.value}
              onClick={() => {
                onMethodChange(m.value);
                if (m.value !== 'transfer') onBankChange(null);
              }}
              label={m.label}
              icon={<Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          );
        })}

        {(method !== null || bank !== null) && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 cursor-pointer text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-strong)]"
            onClick={() => {
              onMethodChange(null);
              onBankChange(null);
            }}
          >
            <X className="mr-1 h-3 w-3" /> Limpiar
          </Button>
        )}
      </div>

      {/* Bank sub-filter only shows for transferencia — keeps the row
          density honest. Pills wrap so a tenant with 8 active banks
          doesn't fight horizontal overflow. */}
      {method === 'transfer' && banksToShow.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-2">
          <span className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
            Banco
          </span>
          <FilterButton
            active={bank === null}
            onClick={() => onBankChange(null)}
            label="Todos"
            small
          />
          {banksToShow.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => onBankChange(bank === b.slug ? null : b.slug)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                bank === b.slug
                  ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)] font-semibold'
                  : 'border-transparent text-[var(--fg-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)]',
              )}
            >
              <BankChip bank={b} size={16} />
              {b.name.replace(/^Banco\s/, '').replace(/^Cooperativa\s/, '')}
            </button>
          ))}
          {activeBank && (
            <span className="ml-auto text-[11px] text-[var(--fg-muted)]">
              Mostrando solo {activeBank.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  icon,
  small,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
        small ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[12.5px]',
        active
          ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
          : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg-strong)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
