'use client';

import { useEffect, useState } from 'react';
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
import { useCreateProduct, useUpdateProduct } from '@/presentation/hooks/use-products';
import { useSettings } from '@/presentation/hooks/use-settings';
import type { Product, ProductType, ProductUnit } from '@/domain/entities/product';

const TYPES: { value: ProductType; label: string; hint: string }[] = [
  { value: 'consumable', label: 'Consumible', hint: 'Solo se usa en servicios' },
  { value: 'sellable', label: 'Vendible', hint: 'Solo se vende suelto' },
  { value: 'both', label: 'Ambos', hint: 'Se consume y se vende' },
];

const UNITS: { value: ProductUnit; label: string }[] = [
  { value: 'u', label: 'Unidad (u)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'g', label: 'Gramo (g)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

export function ProductModal({ open, onClose, product }: Props) {
  const isEdit = Boolean(product);
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const { data: tenant } = useSettings();
  const tenantDefaultTax = tenant?.defaultTaxRate ?? 15;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProductType>('consumable');
  const [unit, setUnit] = useState<ProductUnit>('u');
  const [cost, setCost] = useState('0');
  const [price, setPrice] = useState('0');
  const [taxRate, setTaxRate] = useState('15');
  const [stockMin, setStockMin] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open && product) {
      setName(product.name);
      setSku(product.sku ?? '');
      setDescription(product.description ?? '');
      setType(product.type);
      setUnit(product.unit);
      setCost(String(product.cost));
      setPrice(String(product.price));
      setTaxRate(String(product.taxRate));
      setStockMin(String(product.stockMin));
      setIsActive(product.isActive);
    } else if (open && !product) {
      setName('');
      setSku('');
      setDescription('');
      setType('consumable');
      setUnit('u');
      setCost('0');
      setPrice('0');
      setTaxRate(String(tenantDefaultTax));
      setStockMin('0');
      setIsActive(true);
    }
  }, [open, product, tenantDefaultTax]);

  function handleSave() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      sku: sku.trim() || null,
      description: description.trim() || null,
      type,
      unit,
      cost: parseFloat(cost) || 0,
      price: parseFloat(price) || 0,
      taxRate: parseFloat(taxRate) || 0,
      stockMin: parseFloat(stockMin) || 0,
      isActive,
    };

    const onError = (err: unknown) => {
      const e = err as { response?: { data?: { errors?: Record<string, string[]> } }; message?: string };
      const errors = e?.response?.data?.errors;
      if (errors) {
        toast.error(Object.values(errors)[0]?.[0] ?? 'Error al guardar');
      } else {
        toast.error(e?.message ?? 'Error al guardar');
      }
    };

    if (isEdit && product) {
      update.mutate(
        { id: product.id, input },
        {
          onSuccess: () => {
            toast.success('Producto actualizado');
            onClose();
          },
          onError,
        }
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success('Producto creado');
          onClose();
        },
        onError,
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            Define el producto. El stock se ajusta con compras y movimientos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <Label className="mb-1.5">Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Shampoo concentrado"
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1.5">SKU</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ProductType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-xs text-muted-foreground">{t.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">Unidad</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as ProductUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5">Costo</Label>
              <Input
                type="number"
                step="0.0001"
                min={0}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5">Precio venta</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={type === 'consumable'}
              />
            </div>
            <div>
              <Label className="mb-1.5">IVA %</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5">Stock mínimo</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={stockMin}
                onChange={(e) => setStockMin(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4"
                />
                <span>Activo</span>
              </label>
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="opcional"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()}>
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
