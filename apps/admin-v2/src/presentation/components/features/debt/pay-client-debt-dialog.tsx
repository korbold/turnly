'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { usePayClientDebt } from '@/presentation/hooks/use-debt';
import { planFor, type ClientDebt } from '@/domain/entities/debt';
import { formatCounterCurrency } from '@/shared/utils/format';

const money = formatCounterCurrency;

const METODOS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Otro' },
] as const;

interface Props {
  open: boolean;
  debt: ClientDebt;
  onClose: () => void;
}

/**
 * Cobrar la deuda de una persona con un solo pago, repartido entre sus autos.
 *
 * El reparto se muestra ANTES de confirmar y diciendo a qué vehículo va cada
 * dólar: un automatismo que toca varios autos a la vez, invisible, es
 * exactamente lo que nadie puede auditar después.
 */
export function PayClientDebtDialog({ open, debt, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METODOS)[number]['value']>('cash');
  const [bank, setBank] = useState('');
  const mutation = usePayClientDebt();

  const monto = Number(amount) || 0;
  const excede = monto > debt.total + 0.005;

  // Mismo criterio que el backend: de la más vieja a la más nueva. Si esto y
  // `DebtLedger::planFrom` divergen, la pantalla miente sobre lo que va a pasar.
  const plan = useMemo(() => planFor(debt.items, monto), [debt.items, monto]);
  const etiquetaDe = (id: string) =>
    debt.items.find((i) => i.id === id)?.resourceLabel ?? null;

  function cerrar() {
    setAmount('');
    setBank('');
    setMethod('cash');
    onClose();
  }

  async function cobrar() {
    if (monto <= 0 || excede) return;

    try {
      await mutation.mutateAsync({
        clientId: debt.clientId,
        amount: monto,
        method,
        bank: method === 'transfer' ? bank.trim() || null : null,
      });
      toast.success(
        monto >= debt.total - 0.005 ? 'Deuda saldada' : `Abono de ${money(monto)} registrado`,
      );
      cerrar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'No se pudo registrar el cobro'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrar deuda</DialogTitle>
          <DialogDescription>
            Debe {money(debt.total)} entre todos sus vehículos. El cobro se aplica
            de la deuda más vieja a la más nueva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">Monto</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              value={amount}
              placeholder={debt.total.toFixed(2)}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAmount(String(debt.total))}
                className="text-[12px] font-medium text-[var(--brand-700)] hover:underline"
              >
                Cobrar todo ({money(debt.total)})
              </button>
              {excede && (
                <span className="text-[12px] text-[var(--danger-700)]">
                  Supera lo que debe
                </span>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Método</Label>
            <div className="grid grid-cols-4 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={method === m.value}
                  onClick={() => setMethod(m.value)}
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

          {method === 'transfer' && (
            <div>
              <Label className="mb-1.5">Banco</Label>
              <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Pichincha" />
            </div>
          )}

          {plan.length > 0 && !excede && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Se aplica así
              </p>
              <ul className="mt-1.5 space-y-1">
                {plan.map((linea) => (
                  <li key={`${linea.type}-${linea.id}`} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="min-w-0 truncate text-[var(--fg-secondary)]">
                      {etiquetaDe(linea.id) ?? 'Vehículo'}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--fg-strong)]">
                      {money(linea.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={cobrar} disabled={monto <= 0 || excede || mutation.isPending}>
            {mutation.isPending ? 'Cobrando…' : 'Cobrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
