'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useOpenCashSession } from '@/presentation/hooks/use-cash-session';

interface Props {
  open: boolean;
  businessDate: string;
  onClose: () => void;
}

export function OpenCashDialog({ open, businessDate, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const mutation = useOpenCashSession();

  useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  async function submit() {
    const base = Number(amount);
    if (!Number.isFinite(base) || base < 0) {
      toast.error('Poné la base con la que arranca el cajón');
      return;
    }

    try {
      await mutation.mutateAsync({ businessDate, openingAmount: base });
      toast.success('Caja abierta');
      onClose();
    } catch (e) {
      // El backend explica por qué: puede ser la caja de ayer sin cerrar.
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo abrir la caja');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>
            La base es el efectivo con el que arranca el cajón, antes del primer cobro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="opening-amount">Base</Label>
          <Input
            id="opening-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
