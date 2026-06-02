'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDownUp, Pencil, Package } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useProduct, useProductMovements } from '@/presentation/hooks/use-products';
import { ProductModal } from '@/presentation/components/features/inventory/product-modal';
import { MovementModal } from '@/presentation/components/features/inventory/movement-modal';
import type { StockMovementType } from '@/domain/entities/product';

const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  purchase: 'Compra',
  sale: 'Venta',
  consumption: 'Consumo',
  adjustment: 'Ajuste',
  return: 'Devolución',
};

const MOVEMENT_COLOR: Record<StockMovementType, string> = {
  purchase: 'text-[var(--success-700)] bg-[var(--success-50)]',
  sale: 'text-[var(--brand-700)] bg-[var(--brand-50)]',
  consumption: 'text-[var(--info-700)] bg-[var(--info-50)]',
  adjustment: 'text-[var(--warning-700)] bg-[var(--warning-50)]',
  return: 'text-[var(--info-700)] bg-[var(--info-50)]',
};

function formatStock(value: number, unit: string): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3,
    signDisplay: 'auto',
  }).format(value)} ${unit}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: product, isLoading } = useProduct(id);
  const { data: movements } = useProductMovements(id);
  const [editOpen, setEditOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);

  if (isLoading || !product) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-default)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink-900)]">
            {product.name}
          </h1>
          {product.sku && (
            <p className="font-mono text-[12px] text-[var(--fg-muted)]">SKU {product.sku}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Button>
        <Button onClick={() => setMovementOpen(true)}>
          <ArrowDownUp className="mr-1.5 h-4 w-4" /> Movimiento
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[12px] text-[var(--fg-muted)]">Stock actual</p>
          <p className="mt-1 text-[20px] font-semibold text-[var(--fg-strong)]">
            {formatStock(product.stock?.onHand ?? 0, product.unit)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[12px] text-[var(--fg-muted)]">Stock mínimo</p>
          <p className="mt-1 text-[20px] font-semibold text-[var(--fg-strong)]">
            {formatStock(product.stockMin, product.unit)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[12px] text-[var(--fg-muted)]">Costo promedio</p>
          <p className="mt-1 text-[20px] font-semibold text-[var(--fg-strong)]">
            {formatMoney(product.stock?.avgCost ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[12px] text-[var(--fg-muted)]">Precio venta</p>
          <p className="mt-1 text-[20px] font-semibold text-[var(--fg-strong)]">
            {product.type === 'consumable' ? '—' : formatMoney(product.price)}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[14px] font-semibold text-[var(--fg-strong)]">Kardex</h2>
        {!movements?.data?.length ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-10 text-center">
            <Package className="mb-3 h-5 w-5 text-[var(--fg-secondary)]" />
            <p className="text-[14px] font-medium text-[var(--fg-strong)]">Sin movimientos aún</p>
            <p className="mt-1 max-w-xs text-[12px] text-[var(--fg-secondary)]">
              Registra una compra para empezar a llevar el ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--bg-sunken)] text-left text-[12px] uppercase tracking-wider text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5 text-right">Cantidad</th>
                  <th className="px-4 py-2.5 text-right">Costo unit.</th>
                  <th className="px-4 py-2.5">Usuario</th>
                  <th className="px-4 py-2.5">Nota</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2.5 tabular-nums text-[var(--fg-secondary)]">
                      {m.createdAt.toLocaleString('en-US', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${MOVEMENT_COLOR[m.type]}`}
                      >
                        {MOVEMENT_LABEL[m.type]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--fg-strong)]">
                      {formatStock(m.qty, product.unit)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--fg-secondary)]">
                      {m.unitCost ? formatMoney(m.unitCost) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--fg-secondary)]">{m.user?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[var(--fg-secondary)]">{m.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProductModal open={editOpen} onClose={() => setEditOpen(false)} product={product} />
      <MovementModal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        product={product}
      />
    </div>
  );
}
