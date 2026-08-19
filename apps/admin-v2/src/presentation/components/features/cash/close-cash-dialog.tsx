'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { useCloseCashSession } from '@/presentation/hooks/use-cash-session';
import type { CashSession } from '@/domain/entities/cash-session';

interface Props {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

/** El signo delante del símbolo: "−$5,00" y no "$-5,00". */
const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

/**
 * Cierre ciego. El cajero cuenta y declara; recién después el diálogo revela
 * esperado y diferencia. No hay camino a la segunda pantalla que no pase por
 * la primera, y por eso el resultado vive en el estado de este componente y
 * no en una consulta que se pueda hacer antes.
 */
export function CloseCashDialog({ open, sessionId, onClose }: Props) {
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<CashSession | null>(null);
  const mutation = useCloseCashSession();

  useEffect(() => {
    if (open) {
      setCounted('');
      setNotes('');
      setResult(null);
    }
  }, [open]);

  async function submit() {
    const contado = Number(counted);
    if (!Number.isFinite(contado) || contado < 0) {
      toast.error('Poné cuánto efectivo contaste');
      return;
    }

    try {
      const cerrada = await mutation.mutateAsync({
        sessionId,
        countedAmount: contado,
        notes: notes.trim() || undefined,
      });
      setResult(cerrada);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo cerrar la caja');
    }
  }

  const diff = result?.difference ?? 0;
  const diffTone =
    diff === 0
      ? 'text-[var(--fg-strong)]'
      : diff > 0
        ? 'text-[var(--success-700)]'
        : 'text-[var(--danger-700)]';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {result === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Cerrar caja</DialogTitle>
              <DialogDescription>
                Contá el efectivo del cajón y escribí cuánto hay. El sistema te dice después
                cuánto esperaba.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="counted-amount">Efectivo contado</Label>
              <Input
                id="counted-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="close-notes">Notas (opcional)</Label>
              <Textarea
                id="close-notes"
                rows={2}
                maxLength={500}
                placeholder="Faltó un billete de $5"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={submit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Cerrando…' : 'Cerrar caja'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Caja cerrada</DialogTitle>
              <DialogDescription>Esto es lo que el sistema esperaba en el cajón.</DialogDescription>
            </DialogHeader>

            <dl className="space-y-2 text-[14px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-[var(--fg-secondary)]">Contado</dt>
                <dd className="font-semibold tabular-nums">{money(result.countedAmount ?? 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-[var(--fg-secondary)]">Esperado</dt>
                <dd className="font-semibold tabular-nums">{money(result.expectedAmount ?? 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-2">
                <dt className="font-semibold">Diferencia</dt>
                <dd className={`text-[20px] font-bold tabular-nums ${diffTone}`}>
                  {signed(diff)}
                </dd>
              </div>
            </dl>

            <DialogFooter>
              <Button onClick={onClose}>Listo</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
