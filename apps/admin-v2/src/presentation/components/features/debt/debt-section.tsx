'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useDebt } from '@/presentation/hooks/use-debt';
import { PayDebtDialog } from '@/presentation/components/features/debt/pay-debt-dialog';
import { AddManualDebtDialog } from '@/presentation/components/features/debt/add-manual-debt-dialog';
import { DEBT_ITEM_LABEL } from '@/domain/entities/debt';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro',
};

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

export function DebtSection({ clientResourceId }: { clientResourceId: string }) {
  const { data, isLoading } = useDebt(clientResourceId);
  const [dialog, setDialog] = useState<'pay' | 'manual' | null>(null);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const payments = data?.payments ?? [];

  return (
    <>
      <section
        aria-label="Deuda"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Deuda
            </h2>
          </div>
          <span
            className={`text-[24px] font-bold tabular-nums ${
              total > 0 ? 'text-[var(--warning-700)]' : 'text-[var(--fg-strong)]'
            }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {money(total)}
          </span>
        </div>

        {items.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {items.map((it) => (
              <li key={`${it.type}-${it.id}`} className="flex items-baseline gap-2 text-[13px]">
                <span className="w-[80px] shrink-0 tabular-nums text-[var(--fg-muted)]">
                  {it.date}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--fg-strong)]">
                  {it.label}
                  {it.paid > 0 && (
                    <span className="ml-1.5 text-[11.5px] text-[var(--fg-muted)]">
                      abonado {money(it.paid)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums font-semibold">{money(it.due)}</span>
                <span className="w-[110px] shrink-0 text-right text-[11.5px] text-[var(--fg-muted)]">
                  {DEBT_ITEM_LABEL[it.type]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--fg-secondary)]">Sin deuda pendiente.</p>
        )}

        {/* Lo que ya pagó. Va aunque la deuda esté en cero: es la respuesta a
            "yo ya te pagué", y es justo cuando el saldo llega a cero que hace
            falta poder mostrarlo. */}
        {payments.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Pagos recibidos
            </p>
            <ul className="mt-1.5 space-y-1">
              {payments.map((p) => (
                <li key={p.id} className="flex items-baseline gap-2 text-[12.5px]">
                  <span className="w-[80px] shrink-0 tabular-nums text-[var(--fg-muted)]">
                    {p.paidAt.toISOString().slice(0, 10)}
                  </span>
                  <span className="min-w-0 flex-1 text-[var(--fg-secondary)]">
                    {METHOD_LABEL[p.method] ?? p.method}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-[var(--success-700)]">
                    {money(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog('manual')}>
            Cargar deuda
          </Button>
          {total > 0 && (
            <Button size="sm" onClick={() => setDialog('pay')}>
              Cobrar deuda
            </Button>
          )}
        </div>
      </section>

      <AddManualDebtDialog
        open={dialog === 'manual'}
        clientResourceId={clientResourceId}
        onClose={() => setDialog(null)}
      />
      {data && (
        <PayDebtDialog
          open={dialog === 'pay'}
          debt={data}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
