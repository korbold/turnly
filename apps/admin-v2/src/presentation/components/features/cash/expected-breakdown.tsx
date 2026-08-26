'use client';

import type { CashByPerson, CashMovement } from '@/domain/entities/cash-session';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

interface Props {
  openingAmount: number;
  cashByPerson: CashByPerson[];
  movements: CashMovement[];
  expectedAmount: number;
}

/**
 * De dónde sale el esperado, línea por línea.
 *
 * El desglose por persona existe porque el cajón es de varios: con dos
 * personas cobrando, "faltan $50" no dice nada si no se ve que una tocó $434 y
 * la otra $75. No acusa a nadie, da la conversación.
 *
 * Pero solo con esas filas la cuenta no cerraba en cuanto hubo un movimiento:
 * una caja con base $40, $48 cobrados y $78 retirados esperaba $10, y el
 * bloque mostraba $48 al lado de ese $10 como si se contradijeran. Así que
 * ahora está la suma completa — el bloque explica el esperado en vez de
 * competir con él.
 */
/**
 * La aritmética sola, sin envoltorio: la usa el diálogo de cierre y también el
 * detalle de la caja, que tiene su propio marco.
 */
export function ExpectedMath({
  openingAmount,
  movements,
  expectedAmount,
}: Omit<Props, 'cashByPerson'>) {
  const porTipo = (type: CashMovement['type']) =>
    movements.filter((m) => m.type === type).reduce((t, m) => t + m.amount, 0);

  const ingresos = porTipo('deposit');
  const egresos = porTipo('expense');
  const retiros = porTipo('withdrawal');

  return (
    <dl className="space-y-1 text-[12.5px]">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-[var(--fg-secondary)]">Base</dt>
        <dd className="tabular-nums text-[var(--fg-strong)]">{money(openingAmount)}</dd>
      </div>

      {ingresos > 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-[var(--fg-secondary)]">Ingresos</dt>
          <dd className="tabular-nums text-[var(--fg-strong)]">{signed(ingresos)}</dd>
        </div>
      )}

      {egresos > 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-[var(--fg-secondary)]">Egresos</dt>
          <dd className="tabular-nums text-[var(--fg-strong)]">{signed(-egresos)}</dd>
        </div>
      )}

      {retiros > 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-[var(--fg-secondary)]">Retiros</dt>
          <dd className="tabular-nums text-[var(--fg-strong)]">{signed(-retiros)}</dd>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2 border-t border-[var(--border)] pt-1">
        <dt className="font-semibold text-[var(--fg-strong)]">Esperado en el cajón</dt>
        <dd className="font-semibold tabular-nums text-[var(--fg-strong)]">
          {money(expectedAmount)}
        </dd>
      </div>
    </dl>
  );
}

export function ExpectedBreakdown({
  openingAmount,
  cashByPerson,
  movements,
  expectedAmount,
}: Props) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        Efectivo cobrado por
      </p>

      <ul className="mt-1.5 space-y-1">
        {cashByPerson.map((p) => (
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

      {/* La base y los movimientos, para que la suma cierre a la vista. Sin
          esto un retiro deja el bloque diciendo un número y el arqueo otro. */}
      <div className="mt-2 border-t border-[var(--border)] pt-2">
        <ExpectedMath
          openingAmount={openingAmount}
          movements={movements}
          expectedAmount={expectedAmount}
        />
      </div>
    </div>
  );
}
