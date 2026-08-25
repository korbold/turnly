'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, ArrowLeftRight, MoreHorizontal, Lock } from 'lucide-react';
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
import { useDebt } from '@/presentation/hooks/use-debt';
import { useSettings } from '@/presentation/hooks/use-settings';
import { useCashSession } from '@/presentation/hooks/use-cash-session';
import { format } from 'date-fns';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import { cn } from '@/shared/utils/cn';
import type { PaymentMethod } from '@/domain/entities/service-log';

interface Props {
  serviceLogId: string;
  /** La placa, para avisar si además debe de antes. */
  clientResourceId?: string;
  /** Saldo pendiente, no el precio del servicio. */
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
/** El día del negocio, para preguntar por la caja de hoy. */
const hoyStr = () => format(new Date(), 'yyyy-MM-dd');

export function RegisterPaymentDialog({ serviceLogId, clientResourceId, total, open, onClose }: Props) {
  const hoy = hoyStr();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [bank, setBank] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  // Arranca en el saldo: el caso normal sigue siendo cobrar todo lo que falta,
  // y el cajero sólo toca esto cuando el cliente abona menos.
  const [amount, setAmount] = useState('');
  const mutation = useRecordServiceLogPayment();

  // La deuda vieja de esta placa. Se descuenta este servicio: lo que estás
  // por cobrar no es "deuda de antes". Es el momento en que se puede pedir.
  const { data: debt } = useDebt(clientResourceId ?? '', open && !!clientResourceId);
  const previa = (debt?.items ?? [])
    .filter((it) => it.id !== serviceLogId)
    .reduce((sum, it) => sum + it.due, 0);

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setBank(null);
      setReference('');
      setAmount(total.toFixed(2));
    }
  }, [open, total]);

  useEffect(() => {
    if (method !== 'transfer') setBank(null);
  }, [method]);

  // Efectivo sin caja abierta: el backend lo rechaza, así que el diálogo lo
  // dice antes de que el cajero escriba el monto. Enterarse por un error
  // después de llenar el formulario, con el cliente enfrente, es la peor
  // versión de la misma regla. Sólo afecta al efectivo: tarjeta y
  // transferencia no tocan el cajón.
  const { data: tenant } = useSettings();
  const { data: caja } = useCashSession(hoy);
  const exigeCaja = tenant?.requireOpenTillForCash ?? false;
  const cajaAbierta = caja?.session?.status === 'open';
  const efectivoTrabado = exigeCaja && !cajaAbierta && method === 'cash';

  function submit() {
    if (efectivoTrabado) return;
    if (method === 'transfer' && !bank) {
      toast.error('Selecciona el banco emisor');
      return;
    }
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné cuánto cobrás');
      return;
    }
    mutation.mutate(
      {
        id: serviceLogId,
        data: {
          method,
          bank: method === 'transfer' ? bank : null,
          reference: reference.trim() || null,
          amount: monto,
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
              Por cobrar
            </span>
            <span
              className="font-mono text-[18px] font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {moneyFmt}
            </span>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="payment-amount"
              className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
            >
              Monto
            </Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={total}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {Number(amount) > 0 && Number(amount) < total && (
              <p className="text-[12px] text-[var(--warning-700)]">
                Abono. Quedan{' '}
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
                  .format(total - Number(amount))}{' '}
                por cobrar.
              </p>
            )}
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

          {efectivoTrabado && (
            // El candado se explica y se sale de él: sin caja abierta el
            // billete quedaría fuera del arqueo, que es lo que pasó el 24 de
            // agosto con $45. Las salidas se nombran porque quien lee esto
            // tiene un cliente enfrente.
            <div className="flex gap-2.5 rounded-lg border border-[var(--warning-200)] bg-[var(--warning-50)] p-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-700)]" aria-hidden="true" />
              <p className="text-[12.5px] leading-relaxed text-[var(--warning-700)]">
                <strong>No hay caja abierta.</strong> Sin ella el efectivo no entra a
                ningún arqueo. Abre la caja del día desde el Registro Diario — o si ya
                se cerró, pídele al dueño que la reabra. También puedes cobrar por
                tarjeta o transferencia.
              </p>
            </div>
          )}

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

        {previa > 0 && (
          <p className="rounded-lg bg-[var(--warning-50)] px-3 py-2 text-[12.5px] font-medium text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
            Además debe{' '}
            {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(previa)}{' '}
            de antes.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending || efectivoTrabado}
            className="cursor-pointer"
          >
            Marcar pagado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
