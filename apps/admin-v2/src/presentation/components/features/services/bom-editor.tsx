'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useBom, useReplaceBom } from '@/presentation/hooks/use-service-variants';
import { useProducts } from '@/presentation/hooks/use-products';
import type { ServiceVariant } from '@/domain/entities/service-variant';

interface Props {
  open: boolean;
  onClose: () => void;
  variant: ServiceVariant | null;
}

interface DraftLine {
  productId: string;
  qty: string;
  unit: string;
  productName: string;
}

export function BomEditor({ open, onClose, variant }: Props) {
  const { data: bom } = useBom(variant?.id ?? null);
  const { data: productsPage } = useProducts({ perPage: 100, active: true });
  const replace = useReplaceBom(variant?.id ?? '');

  const [lines, setLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    if (open && bom) {
      setLines(
        bom.map((b) => ({
          productId: b.productId,
          qty: String(b.qty),
          unit: b.product?.unit ?? '',
          productName: b.product?.name ?? '',
        }))
      );
    }
    if (open && !bom?.length) setLines([]);
  }, [open, bom]);

  const products = productsPage?.data ?? [];

  function addLine() {
    const first = products[0];
    setLines((prev) => [
      ...prev,
      {
        productId: first?.id ?? '',
        qty: '0',
        unit: first?.unit ?? '',
        productName: first?.name ?? '',
      },
    ]);
  }

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function changeProduct(i: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(i, {
      productId,
      unit: product?.unit ?? '',
      productName: product?.name ?? '',
    });
  }

  function save() {
    const dedupe = new Set<string>();
    for (const l of lines) {
      if (!l.productId) {
        toast.error('Selecciona un producto en cada línea');
        return;
      }
      if (dedupe.has(l.productId)) {
        toast.error('Producto duplicado: agrega cantidades en la misma línea');
        return;
      }
      dedupe.add(l.productId);
      if (!parseFloat(l.qty) || parseFloat(l.qty) <= 0) {
        toast.error('Las cantidades deben ser mayores a cero');
        return;
      }
    }

    replace.mutate(
      lines.map((l) => ({ productId: l.productId, qty: parseFloat(l.qty) })),
      {
        onSuccess: () => {
          toast.success('Receta guardada');
          onClose();
        },
        onError: () => toast.error('No se pudo guardar la receta'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receta — {variant?.label ?? ''}</DialogTitle>
          <DialogDescription>
            Qué productos se consumen cada vez que se realiza esta variante.
            Al completar la reserva el stock baja automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-center text-[12px] text-[var(--fg-secondary)]">
              Sin insumos. Agrega productos consumidos al completar el servicio.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_60px_36px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2"
                >
                  <Select
                    value={line.productId}
                    onValueChange={(v) => changeProduct(i, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecciona producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.sku ? ` · ${p.sku}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    value={line.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                    placeholder="Cantidad"
                  />
                  <span className="text-center text-[12px] font-mono text-[var(--fg-muted)]">
                    {line.unit || '—'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(i)}
                    className="text-[var(--danger-500)] hover:text-[var(--danger-600)]"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" onClick={addLine} className="w-full" disabled={!products.length}>
            <Plus className="mr-1.5 h-4 w-4" /> Agregar insumo
          </Button>
          {!products.length && (
            <p className="text-[11px] text-[var(--fg-muted)]">
              Crea productos en Inventario antes de definir la receta.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={replace.isPending}>Guardar receta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
