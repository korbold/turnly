'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Lock, RotateCcw, Wallet } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useCashSessions } from '@/presentation/hooks/use-cash-session';
import { capitalizeFirst } from '@/shared/utils/format';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

/** El signo delante del símbolo: "−$5,00" y no "$-5,00". */
const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

/**
 * El historial de cajas.
 *
 * Todo lo que la caja registra —quién abrió, quién movió plata, quién contó,
 * quién reabrió y por qué— vivía en la base sin una pantalla que lo mostrara.
 * Para leer el arqueo que descuadró el 24 de agosto hubo que entrar por SQL a
 * producción, y esa no es una respuesta que el dueño de un lavadero pueda dar.
 *
 * Una diferencia suelta no dice nada; puestas en fila se ve si vienen de una
 * persona, de un día de la semana, o si están creciendo.
 */
export default function CashHistoryPage() {
  const { data: sesiones = [], isLoading } = useCashSessions();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sesiones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
          <Wallet className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
          Todavía no se ha abierto ninguna caja
        </p>
        <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
          La caja se abre desde el Registro Diario, con la base con la que arranca el cajón.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--fg-secondary)]">
        Cada día con su base, lo que se contó y lo que el sistema esperaba.
      </p>

      {/* Encabezado sólo en pantalla ancha: en el teléfono cada fila se lee
          sola, con las etiquetas puestas. */}
      <div className="hidden px-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)] sm:grid sm:grid-cols-[1fr_7rem_7rem_7rem_6rem] sm:gap-3">
        <span>Día</span>
        <span className="text-right">Base</span>
        <span className="text-right">Contado</span>
        <span className="text-right">Esperado</span>
        <span className="text-right">Diferencia</span>
      </div>

      <ul className="space-y-2">
        {sesiones.map((s) => {
          const abierta = s.status === 'open';
          const diff = s.difference ?? 0;

          return (
            <li key={s.id}>
              <Link
                href={`/cash/${s.id}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]/40 sm:grid sm:grid-cols-[1fr_7rem_7rem_7rem_6rem] sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {abierta ? (
                    <Wallet className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-[var(--fg-strong)]">
                      {capitalizeFirst(
                        format(parseISO(s.businessDate), "EEEE d 'de' MMMM", { locale: es }),
                      )}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--fg-muted)]">
                      {s.openedBy ? `Abrió ${s.openedBy.name}` : 'Sin registrar quién abrió'}
                      {s.closedBy ? ` · Cerró ${s.closedBy.name}` : ''}
                    </span>
                  </span>
                </span>

                <span className="mt-2 flex justify-between text-[12.5px] tabular-nums sm:mt-0 sm:block sm:text-right">
                  <span className="text-[var(--fg-muted)] sm:hidden">Base</span>
                  <span className="text-[var(--fg-secondary)]">{money(s.openingAmount)}</span>
                </span>

                <span className="flex justify-between text-[12.5px] tabular-nums sm:block sm:text-right">
                  <span className="text-[var(--fg-muted)] sm:hidden">Contado</span>
                  <span className="text-[var(--fg-secondary)]">
                    {s.countedAmount === null ? '—' : money(s.countedAmount)}
                  </span>
                </span>

                <span className="flex justify-between text-[12.5px] tabular-nums sm:block sm:text-right">
                  <span className="text-[var(--fg-muted)] sm:hidden">Esperado</span>
                  {/* Vacío mientras la caja está abierta: el conteo ciego no
                      depende de desde qué pantalla se mire. */}
                  <span className="text-[var(--fg-secondary)]">
                    {s.expectedAmount === null ? '—' : money(s.expectedAmount)}
                  </span>
                </span>

                <span className="mt-1 flex justify-between sm:mt-0 sm:block sm:text-right">
                  <span className="text-[12.5px] text-[var(--fg-muted)] sm:hidden">Diferencia</span>
                  {abierta ? (
                    <span className="text-[12px] font-semibold text-[var(--fg-muted)]">
                      Abierta
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ring-1 ${
                        diff === 0
                          ? 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)] ring-[var(--border)]'
                          : diff > 0
                            ? 'bg-[var(--success-50)] text-[var(--success-700)] ring-[var(--success-200)]'
                            : 'bg-[var(--danger-50)] text-[var(--danger-700)] ring-[var(--danger-200)]'
                      }`}
                    >
                      {diff === 0 ? 'Cuadró' : signed(diff)}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
