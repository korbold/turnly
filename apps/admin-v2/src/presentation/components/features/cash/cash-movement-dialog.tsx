'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { useAddCashMovement } from '@/presentation/hooks/use-cash-session';
import type { CashMovementType } from '@/domain/entities/cash-session';

interface Props {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

/**
 * Retiro y egreso salen los dos del cajón, pero un retiro NO es un gasto: el
 * dueño se lleva su recaudación. Separarlos acá es lo que permite que el
 * reporte de gastos de mañana no cuente la plata del dueño como costo.
 */
const TYPES: { value: CashMovementType; label: string; hint: string; icon: typeof ArrowUpRight }[] = [
  { value: 'expense',    label: 'Egreso',  hint: 'Almuerzo, insumos',        icon: ArrowUpRight },
  { value: 'withdrawal', label: 'Retiro',  hint: 'El dueño se lleva la caja', icon: HandCoins },
  { value: 'deposit',    label: 'Ingreso', hint: 'Reposición de cambio',      icon: ArrowDownLeft },
];

export function CashMovementDialog({ open, sessionId, onClose }: Props) {
  const [type, setType] = useState<CashMovementType>('expense');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useAddCashMovement();

  useEffect(() => {
    if (open) {
      setType('expense');
      setAmount('');
      setReason('');
    }
  }, [open]);

  async function submit() {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné el monto del movimiento');
      return;
    }
    if (!reason.trim()) {
      // Un egreso sin motivo es un faltante con otro nombre.
      toast.error('Escribí el motivo');
      return;
    }

    try {
      await mutation.mutateAsync({ sessionId, type, amount: monto, reason: reason.trim() });
      toast.success('Movimiento registrado');
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo registrar el movimiento');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento de caja</DialogTitle>
          <DialogDescription>Plata que entra o sale del cajón sin ser un cobro.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                type === value
                  ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                  : 'border-[var(--border)] hover:bg-[var(--bg-sunken)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[13px] font-semibold">{label}</span>
              <span className="text-[11px] leading-tight text-[var(--fg-muted)]">{hint}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-amount">Monto</Label>
          <Input
            id="movement-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-reason">Motivo</Label>
          <Input
            id="movement-reason"
            maxLength={200}
            placeholder="Almuerzo del equipo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
