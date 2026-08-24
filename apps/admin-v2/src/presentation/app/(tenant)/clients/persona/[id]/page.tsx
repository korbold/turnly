'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Car, Wallet } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useClientVehicles } from '@/presentation/hooks/use-clients';
import { useClientDebt } from '@/presentation/hooks/use-debt';
import { PayClientDebtDialog } from '@/presentation/components/features/debt/pay-client-debt-dialog';
import { formatCounterCurrency } from '@/shared/utils/format';
import { clientNameOf, plateOf, vehicleInfoOf } from '@/shared/utils/client-resource';
import { DEBT_ITEM_LABEL } from '@/domain/entities/debt';

const money = formatCounterCurrency;

/**
 * La ficha de una persona: sus vehículos, lo que debe entre todos, y el cobro
 * que se reparte.
 *
 * Existe porque el sistema modelaba autos y no personas: alguien con dos autos
 * tenía su deuda partida en dos fichas sin nada que las sumara, y el cajero
 * cobraba de a una — que es donde se dejan mitades abiertas que nadie ve.
 */
export default function PersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [cobrarAbierto, setCobrarAbierto] = useState(false);

  const { data: vehiculos = [], isLoading } = useClientVehicles(id);
  const { data: deuda } = useClientDebt(id);

  const nombre = vehiculos.length > 0 ? clientNameOf(vehiculos[0]) : null;
  const total = deuda?.total ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Clientes
        </Button>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h1 className="text-[20px] font-semibold text-[var(--fg-strong)]">
          {nombre ?? 'Cliente'}
        </h1>
        <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
          {vehiculos.length === 1 ? '1 vehículo' : `${vehiculos.length} vehículos`}
        </p>

        {/* La deuda de la persona es el número que el mostrador busca: va
            arriba y grande, no escondido entre los autos. */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--border)] pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Debe en total
            </p>
            <p
              className={`mt-0.5 text-[28px] font-semibold tabular-nums ${
                total > 0 ? 'text-[var(--warning-700)]' : 'text-[var(--fg-strong)]'
              }`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {money(total)}
            </p>
          </div>

          {total > 0 && (
            <Button
              onClick={() => setCobrarAbierto(true)}
              className="gap-1.5 bg-[var(--warning-600)] text-white hover:bg-[var(--warning-700)]"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Cobrar deuda
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Vehículos
        </h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {vehiculos.map((v) => (
            <li key={v.id}>
              <Link
                href={`/clients/${v.id}`}
                className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <Car className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-[var(--fg-strong)]">
                    {plateOf(v) ?? v.label ?? 'Sin placa'}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--fg-muted)]">
                    {vehicleInfoOf(v).join(' · ') || 'Sin datos del vehículo'}
                  </span>
                </span>
                {v.debt > 0 && (
                  <span className="shrink-0 text-[12.5px] font-semibold text-[var(--warning-700)] tabular-nums">
                    debe {money(v.debt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {(deuda?.items.length ?? 0) > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            De qué está hecha la deuda
          </h2>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            De la más vieja a la más nueva. Ese orden es el del cobro.
          </p>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {deuda!.items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-[var(--fg-strong)]">
                    {item.label}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--fg-muted)]">
                    {/* De qué auto es: sin esto el cajero no sabe qué le está
                        cobrando al cliente que tiene enfrente. */}
                    {item.resourceLabel ? `${item.resourceLabel} · ` : ''}
                    {DEBT_ITEM_LABEL[item.type]}
                    {item.date ? ` · ${format(new Date(item.date), "d MMM yyyy", { locale: es })}` : ''}
                  </span>
                </span>
                <span
                  className="shrink-0 text-[13.5px] font-semibold tabular-nums text-[var(--warning-700)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {money(item.due)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deuda && (
        <PayClientDebtDialog
          open={cobrarAbierto}
          debt={deuda}
          onClose={() => setCobrarAbierto(false)}
        />
      )}
    </div>
  );
}
