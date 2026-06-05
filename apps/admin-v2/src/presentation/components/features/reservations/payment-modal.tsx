'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useRecordReservationPayment } from '@/presentation/hooks/use-reservations';
import { cn } from '@/shared/utils/cn';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import type { ReservationPaymentMethod } from '@/domain/entities/reservation';

interface Props {
  open: boolean;
  reservationId: string;
  total: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const METHODS: {
  value: ReservationPaymentMethod;
  label: string;
  icon: typeof Banknote;
  hint: string;
}[] = [
  {
    value: 'cash',
    label: 'Efectivo',
    icon: Banknote,
    hint: 'Pago en caja al momento del retiro',
  },
  {
    value: 'card',
    label: 'Tarjeta',
    icon: CreditCard,
    hint: 'Crédito o débito · POS',
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    icon: ArrowLeftRight,
    hint: 'Captura el # de comprobante en la referencia',
  },
];

export function PaymentModal({ open, reservationId, total, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<ReservationPaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState<string | null>(null);
  const mutation = useRecordReservationPayment(reservationId);

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setReference('');
      setBank(null);
    }
  }, [open]);

  // Clear bank selection if cashier switches away from transfer.
  useEffect(() => {
    if (method !== 'transfer') setBank(null);
  }, [method]);

  function submit() {
    if (method === 'transfer' && !bank) {
      toast.error('Selecciona el banco emisor');
      return;
    }
    mutation.mutate(
      {
        method,
        reference: reference.trim() || null,
        bank: method === 'transfer' ? bank : null,
      },
      {
        onSuccess: () => {
          toast.success('Pago registrado');
          onSuccess?.();
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo registrar el pago');
        },
      },
    );
  }

  const moneyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Confirma el método con el que el cliente pagó. La reserva queda
            marcada como pagada y el momento se guarda para conciliación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total recap so the cashier confirms the amount before
              picking a method. Mono font + tabular nums so it scans
              like a receipt line. */}
          <div className="flex items-baseline justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              Total a cobrar
            </span>
            <span
              className="font-mono text-[20px] font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {moneyFmt}
            </span>
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Método de pago
            </Label>
            <div className="grid gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                        active
                          ? 'bg-[var(--brand-100)] text-[var(--brand-700)]'
                          : 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--fg-strong)]">
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)]">
                        {m.hint}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-full border-2',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-500)]'
                          : 'border-[var(--border-strong)] bg-[var(--bg-app)]',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bank picker — only appears for transferencia. Color chip +
              full bank name keeps it scannable for the cashier picking
              from across the counter. */}
          {method === 'transfer' && (
            <div className="space-y-2">
              <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Banco emisor
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ECUADOR_BANKS.map((b) => {
                  const active = bank === b.slug;
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => setBank(b.slug)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-tight"
                        style={{ backgroundColor: b.color, color: b.fg }}
                        aria-hidden="true"
                      >
                        {b.initials}
                      </span>
                      <span className="min-w-0 truncate text-[12px] font-medium text-[var(--fg-strong)]">
                        {b.name.replace(/^Banco\s/, '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Referencia <span className="font-normal normal-case text-[var(--fg-muted)]">(opcional)</span>
            </Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={
                method === 'transfer'
                  ? '# de comprobante'
                  : method === 'card'
                  ? 'Últimos 4 dígitos · voucher'
                  : 'Detalle interno'
              }
              maxLength={100}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} className="cursor-pointer">
            Marcar pagado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
