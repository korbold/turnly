'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/presentation/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useServices } from '@/presentation/hooks/use-services';
import { useServiceVariants } from '@/presentation/hooks/use-service-variants';
import { useProducts } from '@/presentation/hooks/use-products';
import { useAddReservationItem } from '@/presentation/hooks/use-reservations';

interface Props {
  open: boolean;
  reservationId: string;
  onClose: () => void;
}

function formatMoney(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export function AddItemModal({ open, reservationId, onClose }: Props) {
  const add = useAddReservationItem(reservationId);

  const [tab, setTab] = useState<'service' | 'product'>('service');

  // Service variant flow
  const { data: servicesPage } = useServices();
  const services = useMemo(() => servicesPage?.data ?? [], [servicesPage]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const { data: variants } = useServiceVariants(serviceId);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState('1');

  // Product flow
  const { data: productsPage } = useProducts({ perPage: 100, active: true });
  const products = useMemo(
    () => (productsPage?.data ?? []).filter((p) => p.type !== 'consumable'),
    [productsPage]
  );
  const [productId, setProductId] = useState<string | null>(null);
  const [productQty, setProductQty] = useState('1');

  useEffect(() => {
    if (open) {
      setTab('service');
      setServiceId(null);
      setVariantId(null);
      setQty('1');
      setProductId(null);
      setProductQty('1');
    }
  }, [open]);

  useEffect(() => {
    if (variants?.length && !variantId) {
      const active = variants.find((v) => v.isActive) ?? variants[0];
      setVariantId(active.id);
    }
  }, [variants, variantId]);

  function submit() {
    if (tab === 'service') {
      if (!variantId) {
        toast.error('Selecciona una variante');
        return;
      }
      add.mutate(
        { itemType: 'service_variant', refId: variantId, qty: parseInt(qty, 10) || 1 },
        {
          onSuccess: () => {
            toast.success('Servicio agregado');
            onClose();
          },
          onError: (err: unknown) => {
            const e = err as { message?: string };
            toast.error(e?.message ?? 'No se pudo agregar');
          },
        }
      );
    } else {
      if (!productId) {
        toast.error('Selecciona un producto');
        return;
      }
      add.mutate(
        { itemType: 'product', refId: productId, qty: parseInt(productQty, 10) || 1 },
        {
          onSuccess: () => {
            toast.success('Producto agregado');
            onClose();
          },
          onError: (err: unknown) => {
            const e = err as { message?: string };
            toast.error(e?.message ?? 'No se pudo agregar');
          },
        }
      );
    }
  }

  const selectedVariant = variants?.find((v) => v.id === variantId);
  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar a la reserva</DialogTitle>
          <DialogDescription>Servicio (con variante) o producto suelto.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'service' | 'product')}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="service">Servicio</TabsTrigger>
            <TabsTrigger value="product">Producto suelto</TabsTrigger>
          </TabsList>

          <TabsContent value="service" className="space-y-3 pt-2">
            <div>
              <Label className="mb-1.5">Servicio</Label>
              <Select
                value={serviceId ?? ''}
                onValueChange={(v) => {
                  setServiceId(v);
                  setVariantId(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona servicio" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {serviceId && (
              <div>
                <Label className="mb-1.5">Variante</Label>
                <Select value={variantId ?? ''} onValueChange={setVariantId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona variante" /></SelectTrigger>
                  <SelectContent>
                    {(variants ?? []).filter((v) => v.isActive).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label} · {formatMoney(v.price)} · {v.durationMin} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedVariant && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)]/40 p-3 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[var(--fg-secondary)]">Subtotal</span>
                  <strong className="text-[var(--fg-strong)]">
                    {formatMoney(selectedVariant.price * (parseInt(qty, 10) || 1))}
                  </strong>
                </div>
              </div>
            )}

            <div>
              <Label className="mb-1.5">Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="product" className="space-y-3 pt-2">
            <div>
              <Label className="mb-1.5">Producto</Label>
              <Select value={productId ?? ''} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {formatMoney(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!products.length && (
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  No hay productos vendibles activos.
                </p>
              )}
            </div>

            {selectedProduct && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)]/40 p-3 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[var(--fg-secondary)]">Subtotal</span>
                  <strong className="text-[var(--fg-strong)]">
                    {formatMoney(selectedProduct.price * (parseInt(productQty, 10) || 1))}
                  </strong>
                </div>
              </div>
            )}

            <div>
              <Label className="mb-1.5">Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={productQty}
                onChange={(e) => setProductQty(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={add.isPending}>Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
