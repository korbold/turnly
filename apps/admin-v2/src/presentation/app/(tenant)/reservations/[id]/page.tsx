'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Pencil, Receipt, ScanLine, History, Repeat } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { cn } from '@/shared/utils/cn';
import {
  useReservation,
  useReservationItems,
  useReservationChanges,
  useRemoveReservationItem,
  useOverrideReservationItemPrice,
  useTransitionReservation,
  useAddReservationItem,
} from '@/presentation/hooks/use-reservations';
import { useServiceVariants } from '@/presentation/hooks/use-service-variants';
import { CheckInModal } from '@/presentation/components/features/reservations/check-in-modal';
import { AddItemModal } from '@/presentation/components/features/reservations/add-item-modal';
import type { ReservationItem, ReservationStatus } from '@/domain/entities/reservation';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  checked_in: 'Revisando',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No-show',
};

const STATUS_COLOR: Record<ReservationStatus, string> = {
  pending: 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
  confirmed: 'bg-[var(--info-50)] text-[var(--info-700)]',
  checked_in: 'bg-[var(--warning-50)] text-[var(--warning-700)]',
  in_progress: 'bg-[var(--brand-50)] text-[var(--brand-700)]',
  completed: 'bg-[var(--success-50)] text-[var(--success-700)]',
  cancelled: 'bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-fg)]',
  no_show: 'bg-[var(--bg-sunken)] text-[var(--fg-muted)]',
};

const ACTION_LABEL: Record<string, string> = {
  added: 'Agregado',
  removed: 'Eliminado',
  upgraded: 'Subido',
  downgraded: 'Bajado',
  price_override: 'Precio ajustado',
};

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: reservation, isLoading } = useReservation(id);
  const { data: items } = useReservationItems(id);
  const { data: changes } = useReservationChanges(id);
  const remove = useRemoveReservationItem(id);
  const override = useOverrideReservationItemPrice(id);
  const transition = useTransitionReservation();
  const addItem = useAddReservationItem(id);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<ReservationItem | null>(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ReservationItem | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [swapTarget, setSwapTarget] = useState<ReservationItem | null>(null);
  const { data: swapVariants, isLoading: swapLoading } = useServiceVariants(
    swapTarget?.serviceId ?? null,
  );

  const total = useMemo(
    () => (items ?? []).reduce((acc, it) => acc + it.lineTotal, 0),
    [items]
  );

  if (isLoading || !reservation) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const status = reservation.status;
  const canCheckIn = status === 'confirmed';
  const canStart = status === 'checked_in' || status === 'confirmed';
  const canComplete = status === 'in_progress';
  const isEditable = status !== 'completed' && status !== 'cancelled' && status !== 'no_show';
  const canOverride = status === 'checked_in';
  const canRemove = status !== 'in_progress' && isEditable;

  function doRemove() {
    if (!removeTarget) return;
    remove.mutate(
      { itemId: removeTarget.id, reason: removeReason || undefined },
      {
        onSuccess: () => {
          toast.success('Item eliminado');
          setRemoveTarget(null);
          setRemoveReason('');
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo eliminar');
        },
      }
    );
  }

  function doOverride() {
    if (!overrideTarget) return;
    const price = parseFloat(overridePrice);
    if (isNaN(price) || price < 0) {
      toast.error('Precio inválido');
      return;
    }
    if (!overrideReason.trim()) {
      toast.error('La razón es obligatoria');
      return;
    }
    override.mutate(
      { itemId: overrideTarget.id, unitPrice: price, reason: overrideReason },
      {
        onSuccess: () => {
          toast.success('Precio ajustado');
          setOverrideTarget(null);
          setOverridePrice('');
          setOverrideReason('');
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo ajustar');
        },
      }
    );
  }

  async function doSwapVariant(newVariantId: string) {
    if (!swapTarget) return;
    const qty = Math.max(1, Math.round(swapTarget.qty));
    try {
      await remove.mutateAsync({ itemId: swapTarget.id, reason: 'Cambio de variante' });
      await addItem.mutateAsync({
        itemType: 'service_variant',
        refId: newVariantId,
        qty,
      });
      toast.success('Variante cambiada');
      setSwapTarget(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'No se pudo cambiar la variante');
    }
  }

  function doStart() {
    transition.mutate(
      { id, action: 'start' },
      {
        onSuccess: () => toast.success('Servicio iniciado'),
        onError: () => toast.error('No se pudo iniciar'),
      }
    );
  }

  function doComplete() {
    transition.mutate(
      { id, action: 'complete' },
      {
        onSuccess: () => toast.success('Servicio completado'),
        onError: () => toast.error('No se pudo completar'),
      }
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/reservations"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-default)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink-900)]">
              {reservation.client?.name ?? 'Reserva'}
            </h1>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_COLOR[status])}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="text-[13px] text-[var(--fg-secondary)]">
            {reservation.scheduledAt.toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {reservation.clientResource?.plate && (
              <> · {reservation.clientResource.brand} {reservation.clientResource.model} {' '}
                <span className="font-mono">{reservation.clientResource.plate}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCheckIn && (
            <Button onClick={() => setCheckInOpen(true)}>
              <ScanLine className="mr-1.5 h-4 w-4" /> Confirmar llegada
            </Button>
          )}
          {canStart && status === 'checked_in' && (
            <Button onClick={doStart} disabled={transition.isPending}>
              Iniciar servicio
            </Button>
          )}
          {canComplete && (
            <Button onClick={doComplete} disabled={transition.isPending}>
              Completar
            </Button>
          )}
        </div>
      </div>

      {/* Billing snapshot */}
      {reservation.billingSnapshot && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[var(--fg-secondary)]" />
              <h2 className="text-[14px] font-semibold text-[var(--fg-strong)]">Facturación</h2>
            </div>
            <span className="text-[11px] text-[var(--fg-muted)]">
              Capturado {new Date(reservation.billingSnapshot.capturedAt).toLocaleString('en-US')}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
            <div>
              <span className="text-[var(--fg-muted)]">Documento: </span>
              <span className="font-mono">{reservation.billingSnapshot.docType.toUpperCase()} · {reservation.billingSnapshot.docNumber}</span>
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">Razón social: </span>
              <strong className="text-[var(--fg-strong)]">{reservation.billingSnapshot.legalName}</strong>
            </div>
            {reservation.billingSnapshot.email && (
              <div>
                <span className="text-[var(--fg-muted)]">Email: </span>
                {reservation.billingSnapshot.email}
              </div>
            )}
            {reservation.billingSnapshot.address && (
              <div>
                <span className="text-[var(--fg-muted)]">Dirección: </span>
                {reservation.billingSnapshot.address}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Items */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--fg-strong)]">Items</h2>
          {isEditable && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar
            </Button>
          )}
        </div>

        {!items?.length ? (
          <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-center text-[12px] text-[var(--fg-secondary)]">
            Sin items aún.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-[13px]"
              >
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider',
                    it.itemType === 'service_variant'
                      ? 'bg-[var(--info-50)] text-[var(--info-700)]'
                      : 'bg-[var(--success-50)] text-[var(--success-700)]'
                  )}
                >
                  {it.itemType === 'service_variant' ? 'Servicio' : 'Producto'}
                </span>
                <div className="flex-1 truncate">{it.label}</div>
                <div className="font-mono text-[var(--fg-muted)]">x{it.qty}</div>
                <div className="w-20 text-right font-mono text-[var(--fg-secondary)]">{fmt(it.unitPrice)}</div>
                <div className="w-24 text-right font-mono font-semibold text-[var(--fg-strong)]">{fmt(it.lineTotal)}</div>
                <div className="flex gap-1">
                  {isEditable && it.itemType === 'service_variant' && it.serviceId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSwapTarget(it)}
                      aria-label="Cambiar variante"
                    >
                      <Repeat className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canOverride && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setOverrideTarget(it);
                        setOverridePrice(String(it.unitPrice));
                      }}
                      aria-label="Ajustar precio"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[var(--danger-500)] hover:text-[var(--danger-600)]"
                      onClick={() => setRemoveTarget(it)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-3">
              <span className="text-[13px] text-[var(--fg-secondary)]">Total</span>
              <strong className="text-[18px] tabular-nums text-[var(--fg-strong)]">{fmt(total)}</strong>
            </div>
          </div>
        )}
      </section>

      {/* Audit */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--fg-secondary)]" />
          <h2 className="text-[14px] font-semibold text-[var(--fg-strong)]">Historial de cambios</h2>
        </div>
        {!changes?.length ? (
          <p className="text-[12px] text-[var(--fg-secondary)]">Sin cambios registrados.</p>
        ) : (
          <ul className="space-y-2 text-[12.5px]">
            {changes.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--brand-400)]" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <strong className="text-[var(--fg-strong)]">{ACTION_LABEL[c.action] ?? c.action}</strong>
                    {c.label && <span>{c.label}</span>}
                    {c.action === 'price_override' && (
                      <span className="font-mono text-[var(--fg-muted)]">
                        {fmt(c.oldPrice ?? 0)} → {fmt(c.newPrice ?? 0)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)]">
                    {c.changedAt.toLocaleString('en-US')}
                    {c.changedBy && <> · {c.changedBy.name}</>}
                    {c.reason && <> · "{c.reason}"</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CheckInModal
        open={checkInOpen}
        reservationId={id}
        defaultEmail={reservation.client?.email}
        defaultName={reservation.client?.name}
        onClose={() => setCheckInOpen(false)}
        onSuccess={() => setCheckInOpen(false)}
      />

      <AddItemModal
        open={addOpen}
        reservationId={id}
        onClose={() => setAddOpen(false)}
      />

      {/* Remove confirm */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar item</DialogTitle>
            <DialogDescription>
              {removeTarget && (
                <>¿Eliminar <strong>{removeTarget.label}</strong> de la reserva? El cambio se registra en el historial.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="mb-1.5">Razón (opcional)</Label>
            <Input value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
            <Button
              onClick={doRemove}
              disabled={remove.isPending}
              className="bg-[var(--danger-500)] text-white hover:bg-[var(--danger-600)]"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price override */}
      <Dialog open={!!overrideTarget} onOpenChange={(o) => !o && setOverrideTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar precio</DialogTitle>
            <DialogDescription>
              {overrideTarget && (
                <>Precio actual: <strong>{fmt(overrideTarget.unitPrice)}</strong>. Disponible sólo durante check-in.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5">Nuevo precio</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5">Razón</Label>
              <Input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ej. Descuento cliente frecuente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancelar</Button>
            <Button onClick={doOverride} disabled={override.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap variant — delete the current line + add a sibling variant in
          one move. Captures the change in the items audit log as a paired
          remove/add. */}
      <Dialog
        open={!!swapTarget}
        onOpenChange={(o) => !o && setSwapTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar variante</DialogTitle>
            <DialogDescription>
              {swapTarget?.label
                ? <>Actualmente: <strong>{swapTarget.label}</strong></>
                : 'Selecciona otra opción.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            {swapLoading && (
              <p className="text-[13px] text-[var(--fg-secondary)]">Cargando opciones…</p>
            )}
            {!swapLoading && (swapVariants ?? [])
              .filter((v) => v.isActive)
              .filter((v) => v.id !== swapTarget?.refId)
              .map((v) => (
                <button
                  key={v.id}
                  onClick={() => doSwapVariant(v.id)}
                  disabled={remove.isPending || addItem.isPending}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] transition hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)] disabled:opacity-50"
                >
                  <span className="font-medium text-[var(--fg-strong)]">{v.label}</span>
                  <span className="font-mono text-[var(--fg-secondary)]">
                    {fmt(Number(v.price))} · {v.durationMin} min
                  </span>
                </button>
              ))}
            {!swapLoading &&
              (swapVariants ?? []).filter((v) => v.isActive && v.id !== swapTarget?.refId).length === 0 && (
                <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-3 text-center text-[12px] text-[var(--fg-secondary)]">
                  No hay otras variantes activas.
                </p>
              )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapTarget(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
