'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useRecordMovement } from '@/presentation/hooks/use-products';
import type { Product } from '@/domain/entities/product';

type MovementKind = 'purchase' | 'adjustment' | 'return';

const KIND_LABELS: Record<MovementKind, { label: string; hint: string }> = {
  purchase:   { label: 'Compra',  hint: 'Ingreso de stock. Actualiza el costo promedio.' },
  adjustment: { label: 'Ajuste',  hint: 'Corrección manual. Positivo suma, negativo resta.' },
  return:     { label: 'Devolución', hint: 'Reingresa stock por devolución de cliente.' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  defaultKind?: MovementKind;
}

export function MovementModal({ open, onClose, product, defaultKind = 'purchase' }: Props) {
  const record = useRecordMovement();
  const [kind, setKind] = useState<MovementKind>(defaultKind);
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setQty('');
      setUnitCost(product?.cost ? String(product.cost) : '');
      setNote('');
    }
  }, [open, defaultKind, product]);

  function handleSave() {
    if (!product) return;
    const qtyNum = parseFloat(qty);
    if (!qtyNum) return;

    record.mutate(
      {
        productId: product.id,
        type: kind,
        qty: kind === 'adjustment' ? qtyNum : Math.abs(qtyNum),
        unitCost: kind === 'purchase' ? parseFloat(unitCost) || undefined : undefined,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`${KIND_LABELS[kind].label} registrada`);
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo registrar');
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento de stock</DialogTitle>
          <DialogDescription>
            {product ? <>Producto: <strong>{product.name}</strong></> : 'Sin producto'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MovementKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as MovementKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    <div className="flex flex-col">
                      <span>{KIND_LABELS[k].label}</span>
                      <span className="text-xs text-muted-foreground">{KIND_LABELS[k].hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5">
              Cantidad ({product?.unit ?? ''})
              {kind === 'adjustment' && (
                <span className="ml-1 text-xs text-muted-foreground">(+ suma, − resta)</span>
              )}
            </Label>
            <Input
              type="number"
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={kind === 'adjustment' ? 'Ej. -5 o 10' : 'Ej. 100'}
            />
          </div>

          {kind === 'purchase' && (
            <div>
              <Label className="mb-1.5">Costo unitario</Label>
              <Input
                type="number"
                step="0.0001"
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se mezcla con el costo promedio actual.
              </p>
            </div>
          )}

          <div>
            <Label className="mb-1.5">Nota</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="opcional · proveedor, motivo, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={record.isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={record.isPending || !qty}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
