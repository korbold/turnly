'use client';

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

interface Props {
  open: boolean;
  amountDue: number;
  pending: boolean;
  onCharge: () => void;
  onLeaveOwing: () => void;
  onClose: () => void;
}

/**
 * Completar con saldo pendiente es el único momento en que alguien sabe si
 * esto es una deuda o un olvido. Se pregunta acá, una vez, y la respuesta
 * queda en la bitácora.
 */
export function CompleteServiceDialog({
  open, amountDue, pending, onCharge, onLeaveOwing, onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Faltan {money(amountDue)}</DialogTitle>
          <DialogDescription>
            El servicio está listo pero no está pagado del todo. ¿Cobrás ahora, o se lleva
            el vehículo debiendo?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={onLeaveOwing} disabled={pending}>
            Se va debiendo
          </Button>
          <Button onClick={onCharge} disabled={pending}>
            Cobrar ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
