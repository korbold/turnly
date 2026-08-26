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
import { MoneyInput } from '@/presentation/components/ui/money-input';
import { useReopenCashSession } from '@/presentation/hooks/use-cash-session';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

interface Props {
  open: boolean;
  sessionId: string;
  /** Lo contado en el último arqueo, para calcular cuánto salió. */
  countedAmount?: number | null;
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
export function ReopenCashDialog({ open, sessionId, countedAmount, onClose }: Props) {
  const [reason, setReason] = useState('');
  // Cuánto quedó en el cajón. Arranca en lo contado —es decir, "no salió
  // nada"— para que no tocar el campo se comporte como antes de que este
  // campo existiera. Quien hizo el corte lo baja a 0.
  const [quedo, setQuedo] = useState(0);
  const mutation = useReopenCashSession();

  useEffect(() => {
    if (open) {
      setReason('');
      setQuedo(countedAmount ?? 0);
    }
  }, [open, countedAmount]);

  async function submit() {
    const motivo = reason.trim();
    if (motivo.length < 3) {
      toast.error('Escribe por qué se reabre la caja');
      return;
    }

    try {
      await mutation.mutateAsync({
        sessionId,
        reason: motivo,
        // Sólo va cuando hay un arqueo contra el cual medir el corte.
        leftInDrawer: countedAmount === null || countedAmount === undefined ? undefined : quedo,
      });
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

        {/* Lo que salió del cajón al cerrar. Sin esto el arqueo siguiente
            vuelve a pedir todo el efectivo del día: el 25 de agosto se cerró
            con $488, se los llevaron, se reabrió para cobrar $10 y el cierre
            marcó un faltante de $488 que nunca existió. Se pregunta cuánto
            QUEDÓ porque es lo que se puede mirar. */}
        {countedAmount !== null && countedAmount !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="reopen-left">¿Cuánto quedó en el cajón?</Label>
            <MoneyInput
              value={quedo}
              onChange={setQuedo}
              aria-label="Cuánto quedó en el cajón"
            />
            <p className="text-[12px] leading-snug text-[var(--fg-muted)]">
              {(() => {
                const sacado = Math.round((countedAmount - quedo) * 100) / 100;
                if (sacado <= 0) {
                  return `Se contaron ${money(countedAmount)} y siguen en el cajón: no se registra ningún retiro.`;
                }
                return `Se registra un retiro de ${money(sacado)}, así el próximo conteo pide sólo lo que cobres desde ahora.`;
              })()}
            </p>
          </div>
        )}

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
