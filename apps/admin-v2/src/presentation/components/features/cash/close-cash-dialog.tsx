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
import { AlertTriangle } from 'lucide-react';
import { useCashSession, useCloseCashSession } from '@/presentation/hooks/use-cash-session';
import type { CashSession } from '@/domain/entities/cash-session';

interface Props {
  open: boolean;
  sessionId: string;
  /** El día que se está cerrando: de ahí sale lo que quedó sin cobrar. */
  businessDate: string;
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
 *
 * El texto nombra la base a propósito. El primer cierre de FEDER dio −$50, que
 * era exactamente la base ($40) más un aumento ($10): la cajera declaró lo que
 * había COBRADO en vez de lo que había en el cajón. Decir "contá el efectivo"
 * no alcanza — el efectivo cobrado también es efectivo, y es el número que
 * tiene más a mano. Nombrar la base no revela el esperado, así que el cierre
 * sigue siendo ciego.
 */
export function CloseCashDialog({ open, sessionId, businessDate, onClose }: Props) {
  const { data: caja } = useCashSession(businessDate);
  const pendiente = caja?.pendingCollection ?? { count: 0, amount: 0 };
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
      toast.error('Escribe cuánto efectivo contaste');
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
                Cuenta todo el efectivo que hay en el cajón, <strong>incluida la base con la
                que abriste</strong>. El sistema te dice después cuánto esperaba.
              </DialogDescription>
            </DialogHeader>

            {pendiente.count > 0 && (
              // Cerrar con cobros pendientes es lo que dejó $45 fuera de toda
              // caja el 24. No se bloquea: a veces el cliente no vuelve. Pero
              // deja de ser un descuido invisible.
              <div className="flex gap-2.5 rounded-lg border border-[var(--warning-200)] bg-[var(--warning-50)] p-3">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-700)]"
                  aria-hidden="true"
                />
                <p className="text-[12.5px] leading-relaxed text-[var(--warning-700)]">
                  {pendiente.count === 1 ? 'Queda' : 'Quedan'}{' '}
                  <strong>
                    {pendiente.count} {pendiente.count === 1 ? 'servicio' : 'servicios'} sin cobrar
                  </strong>{' '}
                  por {money(pendiente.amount)}. Si alguien todavía va a pagar hoy, cierra después:
                  lo que se cobre con la caja cerrada no entra en este arqueo.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="counted-amount">Efectivo contado (todo el cajón)</Label>
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

            {(result.cashByPerson?.length ?? 0) > 0 && (
              // Con dos personas en un cajón, "faltan $50" no dice nada si no
              // se ve que una tocó $434 y la otra $75. No acusa a nadie: da la
              // conversación.
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Efectivo cobrado por
                </p>
                <ul className="mt-1.5 space-y-1">
                  {result.cashByPerson!.map((p) => (
                    <li
                      key={p.userId ?? p.name}
                      className="flex items-baseline justify-between gap-2 text-[12.5px]"
                    >
                      <span className="min-w-0 truncate text-[var(--fg-secondary)]">
                        {p.name}
                        <span className="text-[var(--fg-muted)]">
                          {' · '}
                          {p.count} {p.count === 1 ? 'cobro' : 'cobros'}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--fg-strong)]">
                        {money(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={onClose}>Listo</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
