'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { usePayDebt } from '@/presentation/hooks/use-debt';
import { planFor, type Debt, type PayDebtInput } from '@/domain/entities/debt';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

const METHODS: { value: PayDebtInput['method']; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
];

interface Props {
  open: boolean;
  debt: Debt;
  onClose: () => void;
}

/**
 * El reparto se muestra ANTES de confirmar, no después. Cobrar cuatro deudas
 * de a una es donde el cajero se equivoca; cobrarlas de un saque sin ver a
 * dónde fue cada dólar es donde se equivoca peor.
 */
export function PayDebtDialog({ open, debt, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayDebtInput['method']>('cash');
  const mutation = usePayDebt();

  useEffect(() => {
    if (open) {
      setAmount(debt.total.toFixed(2));
      setMethod('cash');
    }
  }, [open, debt.total]);

  // El mismo reparto que va a hacer el backend, calculado acá para poder
  // mostrarlo. Si los dos divergen, el cajero ve una cosa y pasa otra.
  const plan = useMemo(
    () => planFor(debt.items, Number(amount) || 0),
    [debt.items, amount],
  );
  const aplicado = useMemo(
    () => plan.reduce((sum, p) => sum + p.amount, 0),
    [plan],
  );
  const sobra = Math.max(0, (Number(amount) || 0) - aplicado);

  async function submit() {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné cuánto cobrás');
      return;
    }

    try {
      await mutation.mutateAsync({
        clientResourceId: debt.clientResourceId,
        amount: monto,
        method,
        allocations: plan,
      });
      toast.success('Deuda cobrada');
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo cobrar la deuda');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrar deuda</DialogTitle>
          <DialogDescription>
            Debe {money(debt.total)}. El cobro se aplica de la deuda más vieja a la más nueva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="debt-amount">Monto</Label>
          <Input
            id="debt-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Método</Label>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                aria-pressed={method === m.value}
                className={cn(
                  'rounded-lg border px-2 py-2 text-[12.5px] font-medium transition-colors',
                  method === m.value
                    ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                    : 'border-[var(--border)] hover:bg-[var(--bg-sunken)]',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* El reparto. Es la razón de ser de este diálogo. */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            <span />
            <span className="text-right">Se abona</span>
            <span className="w-[70px] text-right">Queda</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {debt.items.map((it) => {
              const linea = plan.find((p) => p.type === it.type && p.id === it.id);
              const abona = linea?.amount ?? 0;
              return (
                <li
                  key={`${it.type}-${it.id}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[12.5px]"
                >
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums text-[var(--fg-muted)]">{it.date}</span>{' '}
                    {it.label}
                  </span>
                  <span className="text-right tabular-nums font-semibold">{money(abona)}</span>
                  <span className="w-[70px] text-right tabular-nums text-[var(--fg-muted)]">
                    {money(it.due - abona)}
                  </span>
                </li>
              );
            })}
          </ul>
          {sobra > 0 && (
            <p className="mt-2 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--fg-secondary)]">
              Sobran {money(sobra)}: quedan como saldo a favor del cliente.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Cobrando…' : 'Cobrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
