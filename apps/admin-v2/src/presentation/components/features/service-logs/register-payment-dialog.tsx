'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, ArrowLeftRight, MoreHorizontal } from 'lucide-react';
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
import { useRecordServiceLogPayment } from '@/presentation/hooks/use-service-logs';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import { cn } from '@/shared/utils/cn';
import type { PaymentMethod } from '@/domain/entities/service-log';

interface Props {
  serviceLogId: string;
  total: number;
  open: boolean;
  onClose: () => void;
}

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
  { value: 'other', label: 'Otro', icon: MoreHorizontal },
];

/**
 * Lightweight modal triggered from the daily log list when the cashier
 * needs to mark a "cobrar al retirar" service as paid. Mirrors the
 * reservation payment modal shape so the muscle memory carries.
 */
export function RegisterPaymentDialog({ serviceLogId, total, open, onClose }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [bank, setBank] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const mutation = useRecordServiceLogPayment();

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setBank(null);
      setReference('');
    }
  }, [open]);

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
        id: serviceLogId,
        data: {
          method,
          bank: method === 'transfer' ? bank : null,
          reference: reference.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Pago registrado');
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
            Confirma el método con el que el cliente pagó este servicio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              Total
            </span>
            <span
              className="font-mono text-[18px] font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {moneyFmt}
            </span>
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Método de pago
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left cursor-pointer transition-colors',
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-[13px] font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {method === 'transfer' && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Banco emisor
              </Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {ECUADOR_BANKS.map((b) => {
                  const active = bank === b.slug;
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => setBank(b.slug)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors cursor-pointer',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      <BankChip bank={b} size={20} />
                      <span className="min-w-0 truncate text-[11.5px] font-medium text-[var(--fg-strong)]">
                        {b.name.replace(/^Banco\s/, '').replace(/^Cooperativa\s/, '')}
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
