'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { ExpectedMath } from '@/presentation/components/features/cash/expected-breakdown';
import { useCashSessionDetail } from '@/presentation/hooks/use-cash-session';
import {
  CASH_BILLS,
  CASH_COINS,
  MOVEMENT_TYPE_LABEL,
  type CashBreakdown,
  type CashClosure,
} from '@/domain/entities/cash-session';
import { capitalizeFirst } from '@/shared/utils/format';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

const hora = (d: Date) => format(d, 'HH:mm', { locale: es });

/** Cómo se contó el cajón, en una línea legible: "2×$100 · 1×$50 · 4×25¢". */
function conteoEnPalabras(b: CashBreakdown): string[] {
  const partes: string[] = [];
  for (const v of CASH_BILLS) {
    const n = b.bills?.[v] ?? 0;
    if (n > 0) partes.push(`${n}×$${v}`);
  }
  for (const v of CASH_COINS) {
    const n = b.coins?.[v] ?? 0;
    if (n > 0) partes.push(`${n}×${v === '100' ? '$1' : `${v}¢`}`);
  }
  if (b.otherAmount) partes.push(`${money(b.otherAmount)} en ${b.otherNote ?? 'otros'}`);
  return partes;
}

/**
 * Un arqueo. Si quedó atrás por una reapertura se muestra igual, apagado y
 * con el motivo: reabrir corrige el momento del cierre, no borra el número
 * que alguien ya declaró.
 */
function Arqueo({ c, vigente }: { c: CashClosure; vigente: boolean }) {
  const partes = c.countedBreakdown ? conteoEnPalabras(c.countedBreakdown) : [];

  return (
    <li
      className={`rounded-lg border p-3 ${
        vigente
          ? 'border-[var(--border)] bg-[var(--bg-surface)]'
          : 'border-dashed border-[var(--border)] bg-[var(--bg-sunken)]/50'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-[var(--fg-secondary)]">
          {hora(c.closedAt)}
          {c.closedBy ? ` · ${c.closedBy.name}` : ''}
          {!vigente && ' · quedó atrás'}
        </span>
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            c.difference === 0
              ? 'text-[var(--fg-strong)]'
              : c.difference > 0
                ? 'text-[var(--success-700)]'
                : 'text-[var(--danger-700)]'
          }`}
        >
          {c.difference === 0 ? 'Cuadró' : signed(c.difference)}
        </span>
      </div>

      <p className="mt-1 text-[12.5px] text-[var(--fg-secondary)] tabular-nums">
        Contó {money(c.countedAmount)} · esperaba {money(c.expectedAmount)}
      </p>

      {partes.length > 0 && (
        // Cómo se compuso el conteo: "conté $54,20" no dice si faltó un
        // billete de $20 o veinte monedas de a peso.
        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{partes.join(' · ')}</p>
      )}

      {c.notes && <p className="mt-1 text-[12px] italic text-[var(--fg-muted)]">“{c.notes}”</p>}

      {c.reopenReason && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--fg-secondary)]">
          <RotateCcw className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Reabierta{c.reopenedBy ? ` por ${c.reopenedBy.name}` : ''}: {c.reopenReason}
          </span>
        </p>
      )}
    </li>
  );
}

/**
 * El detalle de una caja: cómo se abrió, qué se movió, quién cobró cuánto y
 * todos los arqueos que se le hicieron.
 *
 * Es la pantalla donde una pregunta como "¿los $40 de la base estaban en el
 * cajón?" deja de necesitar una consulta a la base de datos.
 */
export default function CashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: caja, isLoading } = useCashSessionDetail(id);

  if (isLoading || !caja) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const abierta = caja.status === 'open';
  const ultimo = caja.closures.at(-1) ?? null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/cash')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Caja
      </Button>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h1 className="text-[20px] font-semibold text-[var(--fg-strong)]">
          {capitalizeFirst(
            format(parseISO(caja.businessDate), "EEEE d 'de' MMMM yyyy", { locale: es }),
          )}
        </h1>
        <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
          Abrió {caja.openedBy?.name ?? 'alguien'} a las {hora(caja.openedAt)} con base{' '}
          <span className="font-semibold tabular-nums">{money(caja.openingAmount)}</span>
          {caja.closedAt ? ` · cerró ${caja.closedBy?.name ?? 'alguien'} ${hora(caja.closedAt)}` : ''}
        </p>

        {abierta && (
          <p className="mt-3 rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-[12.5px] text-[var(--fg-secondary)]">
            La caja sigue abierta. Lo que se esperaba en el cajón aparece recién al cerrarla.
          </p>
        )}
      </section>

      {caja.movements.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Movimientos
          </h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {caja.movements.map((m) => (
              <li key={m.id} className="flex items-baseline gap-3 py-2">
                <span className="w-16 shrink-0 text-[12.5px] font-semibold text-[var(--fg-secondary)]">
                  {MOVEMENT_TYPE_LABEL[m.type]}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--fg-strong)]">
                  {m.type === 'deposit' ? '+' : '−'}
                  {money(m.amount)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--fg-muted)]">
                  {m.reason}
                </span>
                <span className="shrink-0 text-[12px] text-[var(--fg-muted)]">
                  {hora(m.createdAt)}
                  {m.createdBy ? ` · ${m.createdBy.name}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(caja.cashByPerson?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Efectivo cobrado por
          </h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {caja.cashByPerson!.map((p) => (
              <li key={p.userId ?? p.name} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-[13.5px] text-[var(--fg-strong)]">
                  {p.name}
                  <span className="text-[12px] text-[var(--fg-muted)]">
                    {' · '}
                    {p.count} {p.count === 1 ? 'cobro' : 'cobros'}
                  </span>
                </span>
                <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]">
                  {money(p.amount)}
                </span>
              </li>
            ))}
          </ul>

          {/* La base y los movimientos, para que la suma cierre a la vista: un
              retiro dejaba este bloque diciendo un número y el arqueo otro. */}
          {caja.expectedAmount !== null && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <ExpectedMath
                openingAmount={caja.openingAmount}
                movements={caja.movements}
                expectedAmount={caja.expectedAmount}
              />
            </div>
          )}
        </section>
      )}

      {caja.cashOutsideSession.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Fuera de caja
          </h2>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            Efectivo cobrado ese día que no cayó en esta caja. No entró en el arqueo.
          </p>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {caja.cashOutsideSession.map((p) => (
              <li key={p.id} className="flex items-baseline gap-3 py-2">
                <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]">
                  {money(p.amount)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--fg-muted)]">
                  {p.receivedBy?.name ?? 'Sin identificar'}
                </span>
                <span className="shrink-0 text-[12px] text-[var(--fg-muted)]">
                  {hora(p.paidAt)}
                  {caja.closedAt && p.paidAt > caja.closedAt
                    ? ' · con el cajón ya cerrado'
                    : ' · antes de abrir'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-[var(--border)] pt-2 text-right text-[12.5px] tabular-nums text-[var(--fg-secondary)]">
            {money(caja.cashOutsideSession.reduce((t, p) => t + p.amount, 0))} en total
          </p>
        </section>
      )}

      {caja.closures.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            {caja.closures.length === 1 ? 'Arqueo' : 'Arqueos'}
          </h2>
          {caja.closures.length > 1 && (
            <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
              Esta caja se reabrió. Los conteos anteriores se conservan.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {caja.closures.map((c) => (
              <Arqueo key={c.id} c={c} vigente={c.id === ultimo?.id && !abierta} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
