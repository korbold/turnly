'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PiggyBank } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/presentation/components/ui/table';
import { useDiscountReport } from '@/presentation/hooks/use-reports';
import { usePermissions } from '@/presentation/hooks/use-permissions';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

/** El signo delante del símbolo: "−$5,00" y no "$-5,00". */
const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

/**
 * Cuándo pasó, con hora: dos cambios de precio el mismo día son la norma y
 * sin la hora no se distinguen. date-fns y no `toISOString()`, que corre a
 * UTC — un cobro de las 21:00 en Ecuador aparecería con la fecha siguiente.
 */
const dateLabel = (d: Date) => format(d, "d MMM HH:mm", { locale: es });

interface Props {
  from: string;
  to: string;
}

/**
 * Lo único de esta feature que el dueño realmente mira. Todo lo anterior
 * (motivo obligatorio, bitácora, reporte del backend) sólo existe para que
 * esta pantalla tenga algo que mostrar.
 */
export function DiscountsSection({ from, to }: Props) {
  const { isOwnerOrAdmin } = usePermissions();
  const { data, isLoading } = useDiscountReport(from, to);

  // El backend ya devuelve 403 para cualquier otro rol; esto evita que la
  // sección se dibuje y luego truene con el error de la petición.
  if (!isOwnerOrAdmin) return null;

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  const totalGivenAway = data?.totalGivenAway ?? 0;
  const byReason = data?.byReason ?? [];
  const byUser = data?.byUser ?? [];
  const items = data?.items ?? [];

  // Es la respuesta buena: una sola línea, sin titular ni cifra en cero
  // encima de tres listas vacías — eso leería como que algo falló.
  if (items.length === 0) {
    return (
      <section
        aria-label="Descuentos"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 print:p-3"
      >
        <p className="text-[13px] text-[var(--fg-secondary)]">
          Ningún precio se apartó del catálogo en este rango.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Descuentos"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 print:p-3"
    >
      <div className="flex items-center gap-2">
        <PiggyBank className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Dejado de cobrar
        </p>
      </div>

      <p
        className="mt-2 text-[34px] font-bold leading-none tabular-nums text-[var(--danger-700)] print:mt-1 print:text-[22px]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {money(totalGivenAway)}
      </p>

      {/* Por motivo */}
      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Por motivo
        </p>
        <ul className="mt-2 space-y-1.5">
          {byReason.map((g) => (
            <li
              key={g.code ?? '__none__'}
              className="flex items-baseline justify-between gap-2 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate text-[var(--fg-strong)]">
                {g.label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-[var(--fg-strong)]">
                {money(g.total)}
              </span>
              <span className="w-[70px] shrink-0 text-right text-[12px] text-[var(--fg-muted)]">
                {g.count} {g.count === 1 ? 'vez' : 'veces'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Por quién — sólo cuando hay más de una persona: con una sola no
          hay comparación posible y la sección es ruido. */}
      {byUser.length > 1 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Por quién
          </p>
          <ul className="mt-2 space-y-1.5">
            {byUser.map((g, i) => (
              <li
                key={`${g.name}-${i}`}
                className="flex items-baseline justify-between gap-2 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate text-[var(--fg-strong)]">
                  {g.name}
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-[var(--fg-strong)]">
                  {money(g.total)}
                </span>
                <span className="w-[70px] shrink-0 text-right text-[12px] text-[var(--fg-muted)]">
                  {g.count} {g.count === 1 ? 'vez' : 'veces'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalle */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Detalle
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Quién</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead className="text-right">Catálogo → Cobrado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={`${it.source}-${it.id}`}>
                  <TableCell
                    className="whitespace-nowrap tabular-nums text-[13px] text-[var(--fg-secondary)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {dateLabel(it.date)}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-[13px]">
                    {it.userName ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-[13px] text-[var(--fg-secondary)]">
                    {it.clientLabel ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-[13px]">
                    {it.serviceLabel ?? '—'}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-right tabular-nums text-[13px]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {money(it.catalog)} → {money(it.charged)}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right tabular-nums text-[13px] font-semibold ${
                      it.difference < 0
                        ? 'text-[var(--danger-700)]'
                        : 'text-[var(--fg-strong)]'
                    }`}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {signed(it.difference)}
                  </TableCell>
                  <TableCell className="max-w-[220px] text-[13px] text-[var(--fg-secondary)]">
                    {it.reasonLabel ?? 'Sin motivo'}
                    {it.reasonCode === 'otro' && it.note && (
                      <span className="block truncate text-[11.5px] text-[var(--fg-muted)]">
                        {it.note}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
