'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useAddManualDebt } from '@/presentation/hooks/use-debt';

interface Props {
  open: boolean;
  clientResourceId: string;
  onClose: () => void;
}

/** Para pasar la libreta al sistema una vez y no volver a abrirla. */
export function AddManualDebtDialog({ open, clientResourceId, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [incurredOn, setIncurredOn] = useState('');
  const mutation = useAddManualDebt();

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setIncurredOn(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  async function submit() {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné el monto de la deuda');
      return;
    }
    if (!reason.trim()) {
      // Una deuda sin motivo no se puede defender el día que el cliente la
      // discute.
      toast.error('Escribí de qué es la deuda');
      return;
    }

    try {
      await mutation.mutateAsync({
        clientResourceId,
        amount: monto,
        reason: reason.trim(),
        incurredOn,
      });
      toast.success('Deuda cargada');
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo cargar la deuda');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar deuda</DialogTitle>
          <DialogDescription>
            Una deuda que viene de antes del sistema. Se cobra igual que cualquier otra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="manual-amount">Monto</Label>
          <Input
            id="manual-amount"
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
          <Label htmlFor="manual-reason">De qué es</Label>
          <Input
            id="manual-reason"
            maxLength={200}
            placeholder="3 lavados de julio, cuaderno"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-date">Cuándo se generó</Label>
          <Input
            id="manual-date"
            type="date"
            value={incurredOn}
            onChange={(e) => setIncurredOn(e.target.value)}
          />
          <p className="text-[11.5px] text-[var(--fg-muted)]">
            No la fecha de hoy: la fecha real de la deuda. Es la que decide el orden del cobro.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Cargando…' : 'Cargar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
