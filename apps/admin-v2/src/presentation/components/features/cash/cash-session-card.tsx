'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Lock, Wallet } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useCashSession } from '@/presentation/hooks/use-cash-session';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import { OpenCashDialog } from '@/presentation/components/features/cash/open-cash-dialog';
import { CashMovementDialog } from '@/presentation/components/features/cash/cash-movement-dialog';
import { CloseCashDialog } from '@/presentation/components/features/cash/close-cash-dialog';
import { MOVEMENT_TYPE_LABEL } from '@/domain/entities/cash-session';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

/**
 * El signo va delante del símbolo, no entre el símbolo y el número: dejar que
 * Intl formatee el negativo da "$-5,00", que se lee como un precio raro en vez
 * de como un faltante.
 */
const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

interface Props {
  date: string;
}

/**
 * La caja del día, arriba del registro. Deliberadamente NO muestra el
 * esperado mientras está abierta: el backend no lo manda, y si lo mandara el
 * cajero copiaría ese número en el conteo.
 */
export function CashSessionCard({ date }: Props) {
  const { canManageCash } = usePermissions();
  const { data, isLoading } = useCashSession(date);
  const [openDialog, setOpenDialog] = useState<'open' | 'movement' | 'close' | null>(null);

  // Sin el privilegio la tarjeta no existe: un lavador no tiene por qué saber
  // cuánto hay en el cajón.
  if (!canManageCash) return null;

  if (isLoading) {
    return <Skeleton className="h-[76px] w-full rounded-xl" />;
  }

  const session = data?.session ?? null;
  const huerfano = data?.cashWithoutSession ?? 0;

  // Sin caja abierta. El aviso aparece sólo si además hubo efectivo cobrado:
  // la caja no bloquea el mostrador, pero tampoco calla la plata suelta.
  if (session === null) {
    return (
      <>
        <section
          aria-label="Caja del día"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
        >
          <Wallet className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Caja del día
          </span>
          <span className="text-[13px] text-[var(--fg-secondary)]">Sin abrir</span>

          {huerfano > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {money(huerfano)} cobrados en efectivo sin caja
            </span>
          )}

          <Button size="sm" className="ml-auto" onClick={() => setOpenDialog('open')}>
            Abrir caja
          </Button>
        </section>

        <OpenCashDialog
          open={openDialog === 'open'}
          businessDate={date}
          onClose={() => setOpenDialog(null)}
        />
      </>
    );
  }

  const abierta = session.status === 'open';
  const hora = format(session.openedAt, 'HH:mm');
  const dia = format(parseISO(session.businessDate), "d 'de' MMMM", { locale: es });
  const movimientos = session.movements.length;
  const diff = session.difference ?? 0;

  return (
    <>
      <section
        aria-label="Caja del día"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
      >
        {abierta ? (
          <Wallet className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        ) : (
          <Lock className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Caja del día
        </span>

        <span className="text-[13px] text-[var(--fg-secondary)]">
          {abierta
            ? `abierta ${hora}${session.openedBy ? ` por ${session.openedBy.name}` : ''}`
            : `cerrada · ${dia}`}
        </span>

        <span className="text-[13px] text-[var(--fg-secondary)]">
          Base <span className="font-semibold tabular-nums">{money(session.openingAmount)}</span>
          {movimientos > 0 && (
            <>
              {' · '}
              {movimientos} {movimientos === 1 ? 'movimiento' : 'movimientos'}
            </>
          )}
        </span>

        {!abierta && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ${
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

        {abierta && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenDialog('movement')}>
              Movimiento
            </Button>
            <Button size="sm" onClick={() => setOpenDialog('close')}>
              Cerrar caja
            </Button>
          </div>
        )}
      </section>

      {/* Los movimientos, listados debajo. Se ven mientras la caja está
          abierta a propósito: son pocos y el cajero necesita revisarlos. El
          número que no se revela es el efectivo cobrado, que es el grueso. */}
      {movimientos > 0 && (
        <ul className="-mt-1 space-y-1 px-4 text-[12.5px] text-[var(--fg-secondary)]">
          {session.movements.map((m) => (
            <li key={m.id} className="flex items-baseline gap-2">
              <span className="font-semibold">{MOVEMENT_TYPE_LABEL[m.type]}</span>
              <span className="tabular-nums">
                {m.type === 'deposit' ? '+' : '−'}
                {money(m.amount)}
              </span>
              <span className="truncate text-[var(--fg-muted)]">{m.reason}</span>
            </li>
          ))}
        </ul>
      )}

      <CashMovementDialog
        open={openDialog === 'movement'}
        sessionId={session.id}
        onClose={() => setOpenDialog(null)}
      />
      <CloseCashDialog
        open={openDialog === 'close'}
        sessionId={session.id}
        onClose={() => setOpenDialog(null)}
      />
    </>
  );
}
