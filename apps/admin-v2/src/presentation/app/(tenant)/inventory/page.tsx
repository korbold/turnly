'use client';

import { useMemo, useState } from 'react';
import { Plus, Package, AlertTriangle, Search, Pencil, ArrowDownUp } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { useProducts } from '@/presentation/hooks/use-products';
import { ProductModal } from '@/presentation/components/features/inventory/product-modal';
import { MovementModal } from '@/presentation/components/features/inventory/movement-modal';
import type { Product } from '@/domain/entities/product';
import Link from 'next/link';

function formatStock(value: number, unit: string): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

const TYPE_LABEL: Record<Product['type'], string> = {
  consumable: 'Consumible',
  sellable: 'Vendible',
  both: 'Ambos',
};

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [showLow, setShowLow] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const { data, isLoading } = useProducts({
    perPage: 100,
    lowStock: showLow || undefined,
  });

  const items = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.name, p.sku].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
    );
  }, [data, search]);

  const lowCount = (data?.data ?? []).filter((p) => p.stock?.low).length;

  function openCreate() {
    setEditing(null);
    setProductModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setProductModalOpen(true);
  }
  function openMovement(p: Product) {
    setMovementProduct(p);
    setMovementModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showLow ? 'default' : 'outline'}
            onClick={() => setShowLow((v) => !v)}
            className="gap-1.5"
          >
            <AlertTriangle className="h-4 w-4" />
            Stock bajo
            {lowCount > 0 && (
              <span className="ml-1 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-700)]">
                {lowCount}
              </span>
            )}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <Package className="h-5 w-5 text-[var(--fg-secondary)]" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
            {search ? 'Sin coincidencias' : 'Sin productos aún'}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
            {search
              ? 'Prueba con otro nombre o limpia la búsqueda.'
              : 'Crea productos para llevar control de tu inventario y consumibles.'}
          </p>
          {!search && (
            <Button onClick={openCreate} className="mt-5">
              <Plus className="mr-1.5 h-4 w-4" />
              Crear primer producto
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <article
              key={p.id}
              className={cn(
                'flex flex-col gap-3 rounded-xl border bg-[var(--bg-surface)] p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center',
                p.stock?.low
                  ? 'border-[var(--warning-200)] bg-[var(--warning-50)]/40'
                  : 'border-[var(--border)]'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/inventory/${p.id}`}
                    className="truncate text-[14px] font-semibold leading-snug text-[var(--fg-strong)] hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-secondary)]">
                    {TYPE_LABEL[p.type]}
                  </span>
                  {p.sku && (
                    <span className="font-mono text-[11px] text-[var(--fg-muted)]">SKU {p.sku}</span>
                  )}
                  {p.stock?.low && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-700)]">
                      <AlertTriangle className="h-3 w-3" /> Stock bajo
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--fg-secondary)]">
                  <span>
                    Stock:{' '}
                    <strong className="text-[var(--fg-strong)]">
                      {formatStock(p.stock?.onHand ?? 0, p.unit)}
                    </strong>
                  </span>
                  <span>Mínimo: {formatStock(p.stockMin, p.unit)}</span>
                  {p.type !== 'consumable' && (
                    <span>Precio: {formatMoney(p.price)}</span>
                  )}
                  <span className="text-[var(--fg-muted)]">Costo prom: {formatMoney(p.stock?.avgCost ?? 0)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openMovement(p)}>
                  <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" />
                  Movimiento
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ProductModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        product={editing}
      />
      <MovementModal
        open={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        product={movementProduct}
      />
    </div>
  );
}
