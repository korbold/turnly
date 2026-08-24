'use client';

import { useState } from 'react';
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
import { useCancelServiceLog } from '@/presentation/hooks/use-service-logs';
import {
  CANCEL_REASONS,
  CANCEL_REASON_REQUIRES_NOTE,
} from '@/shared/constants/cancel-reasons';
import type { ServiceLog } from '@/domain/entities/service-log';

interface Props {
  log: ServiceLog;
  open: boolean;
  onClose: () => void;
}

/**
 * Anular un registro. Reemplaza al borrado, que era físico y no dejaba ni
 * quién ni cuándo — en la única pantalla del sistema que lleva caja.
 *
 * Pide motivo de una lista cerrada porque dentro de un mes "anulado" solo no
 * responde nada, y la pregunta que el dueño se va a hacer es por qué
 * desaparecen tickets del día.
 */
export function CancelLogDialog({ log, open, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const mutation = useCancelServiceLog();

  // Se limpia al cerrar y no con un efecto sobre `open`: setState dentro de
  // un efecto encadena renders, y acá no hace falta — el diálogo siempre se
  // cierra por acá.
  function cerrar() {
    setReason('');
    setNote('');
    onClose();
  }

  const necesitaNota = reason === CANCEL_REASON_REQUIRES_NOTE;
  const puedeAnular = !!reason && (!necesitaNota || !!note.trim());

  function handleSubmit() {
    if (!puedeAnular) return;

    mutation.mutate(
      { id: log.id, reasonCode: reason, reasonNote: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Registro anulado');
          cerrar();
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'No se pudo anular el registro')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular registro</DialogTitle>
          <DialogDescription>
            La fila queda a la vista pero sale de los totales del día y ya no se
            puede editar ni cobrar. Si tenía un cobro, se revierte; lo vendido
            vuelve al inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label>Motivo</Label>
          <div className="grid gap-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.code}
                type="button"
                role="radio"
                aria-checked={reason === r.code}
                onClick={() => {
                  setReason(r.code);
                  // Una nota escrita bajo "Otro" no debe viajar en silencio si
                  // después se cambia de motivo.
                  if (r.code !== CANCEL_REASON_REQUIRES_NOTE) setNote('');
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  reason === r.code
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]/40'
                    : 'border-[var(--border)] hover:bg-[var(--bg-sunken)]',
                )}
              >
                <span className="block text-[13.5px] font-medium text-[var(--fg-strong)]">
                  {r.label}
                </span>
                <span className="block text-[12px] text-[var(--fg-muted)]">{r.hint}</span>
              </button>
            ))}
          </div>

          {necesitaNota && (
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="¿De qué se trata?"
              aria-label="Detalle del motivo"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!puedeAnular || mutation.isPending}
            className="bg-[var(--danger-600)] text-white hover:bg-[var(--danger-700)]"
          >
            {mutation.isPending ? 'Anulando…' : 'Anular registro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
