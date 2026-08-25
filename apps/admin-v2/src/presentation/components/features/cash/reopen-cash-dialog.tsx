'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { useReopenCashSession } from '@/presentation/hooks/use-cash-session';

interface Props {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

/**
 * Reabrir una caja que se cerró antes de que terminara el día.
 *
 * El 24 de agosto FEDER cerró a las 18:35 con 8 servicios sin cobrar por
 * $305; veintiún minutos después cobraron $45 de uno y ese pago no cayó en
 * ninguna caja. Sin reapertura, la única salida era que ese dinero quedara
 * fuera del arqueo para siempre.
 *
 * El motivo es obligatorio y el arqueo anterior no se borra: reabrir corrige
 * el momento del cierre, no el número que alguien ya declaró.
 */
export function ReopenCashDialog({ open, sessionId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const mutation = useReopenCashSession();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  async function submit() {
    const motivo = reason.trim();
    if (motivo.length < 3) {
      toast.error('Escribe por qué se reabre la caja');
      return;
    }

    try {
      await mutation.mutateAsync({ sessionId, reason: motivo });
      toast.success('Caja reabierta');
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'No se pudo reabrir la caja'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir caja</DialogTitle>
          <DialogDescription>
            El conteo que ya se hizo queda guardado y el efectivo que se haya cobrado
            con la caja cerrada vuelve a este arqueo. Al terminar hay que contar y
            cerrar de nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reopen-reason">Motivo</Label>
          <Textarea
            id="reopen-reason"
            rows={2}
            maxLength={200}
            placeholder="Se cerró antes de tiempo, faltaba cobrar servicios"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Reabriendo…' : 'Reabrir caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
