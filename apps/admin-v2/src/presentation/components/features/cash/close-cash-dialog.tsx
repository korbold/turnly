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
import {
  CASH_BILLS,
  CASH_COINS,
  breakdownTotal,
  type CashBreakdown,
  type CashSession,
} from '@/domain/entities/cash-session';

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
 * Una denominación: cuántos hay de este billete o de esta moneda.
 *
 * Vacío en vez de 0 mientras nadie escribe: un formulario que arranca lleno de
 * ceros se puede firmar sin tocarlo, que es justamente lo que este conteo
 * viene a impedir.
 */
function DenominationRow({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-right text-[12.5px] font-medium tabular-nums text-[var(--fg-secondary)]">
        {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        className="h-8 text-[13px]"
        placeholder="0"
        value={value === 0 ? '' : String(value)}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        autoFocus={autoFocus}
        aria-label={`Cuántos de ${label}`}
      />
    </label>
  );
}

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
  const [bills, setBills] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState<Record<string, number>>({});
  const [otherAmount, setOtherAmount] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<CashSession | null>(null);
  const mutation = useCloseCashSession();

  useEffect(() => {
    if (open) {
      setBills({});
      setCoins({});
      setOtherAmount('');
      setOtherNote('');
      setNotes('');
      setResult(null);
    }
  }, [open]);

  const otros = Number(otherAmount) || 0;
  const desglose: CashBreakdown = {
    bills,
    coins,
    ...(otros > 0 ? { otherAmount: otros, otherNote } : {}),
  };
  // El total se calcula mientras se cuenta, pero no viaja: el backend lo saca
  // del desglose. Acá es una ayuda de lectura, no el dato.
  const total = breakdownTotal(desglose);
  const contoAlgo = Object.values(bills).some((n) => n > 0)
    || Object.values(coins).some((n) => n > 0)
    || otros > 0;

  async function submit() {
    if (otros > 0 && !otherNote.trim()) {
      toast.error('Escribe qué son esos otros valores');
      return;
    }

    try {
      const cerrada = await mutation.mutateAsync({
        sessionId,
        breakdown: { ...desglose, otherNote: otherNote.trim() || undefined },
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

            {/* Contar por denominación y no escribir un total: es lo que
                hace imposible declarar un número sacado de otro lado. Con un
                campo vacío que pide "cuánto hay", el 24 de agosto entró
                exactamente el efectivo cobrado — que no era lo que había en el
                cajón. Acá hay que mirar adentro para llenarlo, y la suma la
                hace el sistema. */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Billetes
                  </p>
                  <div className="space-y-1.5">
                    {CASH_BILLS.map((v) => (
                      <DenominationRow
                        key={`b${v}`}
                        label={`$${v}`}
                        value={bills[v] ?? 0}
                        onChange={(n) => setBills((prev) => ({ ...prev, [v]: n }))}
                        autoFocus={v === CASH_BILLS[0]}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Monedas
                  </p>
                  <div className="space-y-1.5">
                    {CASH_COINS.map((v) => (
                      <DenominationRow
                        key={`c${v}`}
                        label={v === '100' ? '$1' : `${v}¢`}
                        value={coins[v] ?? 0}
                        onChange={(n) => setCoins((prev) => ({ ...prev, [v]: n }))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Vales, cheques, vouchers. Están en el cajón y cuentan, pero
                  no son una denominación — y sin decir qué son, un "otros $5"
                  es un faltante con otro nombre. */}
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="Otros $"
                  value={otherAmount}
                  onChange={(e) => setOtherAmount(e.target.value)}
                  aria-label="Otros valores en el cajón"
                />
                <Input
                  placeholder="Vales, cheques…"
                  value={otherNote}
                  maxLength={120}
                  onChange={(e) => setOtherNote(e.target.value)}
                  aria-label="Qué son esos otros valores"
                  disabled={otros <= 0}
                />
              </div>

              <div className="flex items-baseline justify-between rounded-lg bg-[var(--bg-sunken)] px-3 py-2">
                <span className="text-[12.5px] font-semibold text-[var(--fg-secondary)]">
                  Total contado
                </span>
                <span
                  className="text-[18px] font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {money(total)}
                </span>
              </div>
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
              <Button onClick={submit} disabled={mutation.isPending || !contoAlgo}>
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
