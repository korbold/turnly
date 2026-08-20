'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  ScanLine,
  History,
  Repeat,
  Clock,
  CheckCircle2,
  Play,
  Trophy,
  XCircle,
  UserX,
  User,
  Car,
  Calendar,
  Mail,
  Hash,
  Wrench,
  Package,
  Wallet,
  Banknote,
  CreditCard,
  ArrowLeftRight,
} from 'lucide-react';
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
import { apiErrorMessage } from '@/shared/utils/api-error';
import {
  PRICE_CHANGE_REASONS,
  REASON_REQUIRES_NOTE,
} from '@/shared/constants/price-change-reasons';
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
import { PaymentModal } from '@/presentation/components/features/reservations/payment-modal';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { findBank } from '@/shared/constants/banks';
import type {
  ReservationPaymentMethod,
  ReservationItem,
  ReservationStatus,
} from '@/domain/entities/reservation';

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

const STATUS_ICON: Record<ReservationStatus, typeof Clock> = {
  pending: Clock,
  confirmed: CheckCircle2,
  checked_in: ScanLine,
  in_progress: Play,
  completed: Trophy,
  cancelled: XCircle,
  no_show: UserX,
};

const PAYMENT_METHOD_LABEL: Record<ReservationPaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const PAYMENT_METHOD_ICON: Record<ReservationPaymentMethod, typeof Wallet> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
};

function formatDuration(startISO: Date, endISO: Date): string {
  const minutes = Math.max(0, Math.round((endISO.getTime() - startISO.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Stat({
  icon: Icon,
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 truncate',
          mono && 'font-mono tabular-nums',
          emphasis
            ? 'text-[16px] font-bold text-[var(--fg-strong)]'
            : 'text-[14px] font-semibold text-[var(--fg-strong)]',
        )}
        style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function BillingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-[var(--fg-strong)]">{value}</dd>
    </div>
  );
}

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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<ReservationItem | null>(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
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
  // Paying locks the items — the SRI invoice is generated from them, so no
  // adding, removing, or re-pricing once payment is recorded.
  const isPaid = reservation.paymentStatus === 'paid';
  const isEditable = !isPaid && status !== 'completed' && status !== 'cancelled' && status !== 'no_show';
  const canOverride = !isPaid && status === 'checked_in';
  const canRemove = !isPaid && status !== 'in_progress' && isEditable;

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
    if (!overrideReason) {
      toast.error('Elegí el motivo');
      return;
    }
    if (overrideReason === REASON_REQUIRES_NOTE && !overrideNote.trim()) {
      toast.error('Elegiste "Otro": escribí de qué se trata.');
      return;
    }
    override.mutate(
      {
        itemId: overrideTarget.id,
        unitPrice: price,
        reasonCode: overrideReason,
        note: overrideNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Precio ajustado');
          setOverrideTarget(null);
          setOverridePrice('');
          setOverrideReason('');
          setOverrideNote('');
        },
        // El backend explica por qué rechazó (REASON_INVALID, STATE_BLOCKED);
        // `e.message` a secas le mostraba al cajero "Request failed with
        // status code 422".
        onError: (err: unknown) => {
          toast.error(apiErrorMessage(err, 'No se pudo ajustar'));
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

  const StatusIcon = STATUS_ICON[status];
  const startTime = reservation.scheduledAt;
  const endTime = reservation.estimatedEnd;
  const duration = formatDuration(startTime, endTime);
  const itemsCount = items?.length ?? 0;
  const hasResource = !!reservation.clientResource?.plate;
  const isTerminal = status === 'completed' || status === 'cancelled' || status === 'no_show';
  // The "pending payment" banner only makes sense for live bookings —
  // a cancelled / no-show row never expects money, and a paid one is
  // already closed. Otherwise (pending → completed lifecycle), surface
  // it once the service is finished and money still hasn't landed,
  // which is the car-wash-at-pickup signal staff want loud.
  const showPaymentPendingBanner =
    !isPaid && status === 'completed';
  const canRecordPayment =
    !isPaid && status !== 'cancelled' && status !== 'no_show' && total > 0;

  return (
    <div className="space-y-4">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href={`/reservations?reservation=${id}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]"
              aria-label="Volver al listado con el detalle abierto"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                <Hash className="h-3 w-3" />
                <span className="font-mono normal-case">{id.slice(0, 8)}</span>
              </div>
              <h1 className="mt-1 truncate text-[22px] font-bold leading-tight tracking-[-0.01em] text-[var(--ink-900)] sm:text-[26px]">
                {reservation.client?.name ?? 'Reserva'}
              </h1>
              <div className="mt-2 inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    STATUS_COLOR[status],
                  )}
                >
                  <StatusIcon className="h-3 w-3" aria-hidden="true" />
                  {STATUS_LABEL[status]}
                </span>
              </div>
            </div>
          </div>

          {/* Primary actions — only when there's something the user can do here */}
          {!isTerminal && (canCheckIn || (canStart && status === 'checked_in') || canComplete) && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {canCheckIn && (
                <Button size="lg" onClick={() => setCheckInOpen(true)} className="cursor-pointer">
                  <ScanLine className="mr-1.5 h-4 w-4" /> Confirmar llegada
                </Button>
              )}
              {canStart && status === 'checked_in' && (
                <Button
                  size="lg"
                  onClick={doStart}
                  disabled={transition.isPending}
                  className="cursor-pointer"
                >
                  <Play className="mr-1.5 h-4 w-4" /> Iniciar servicio
                </Button>
              )}
              {canComplete && (
                <Button
                  size="lg"
                  onClick={doComplete}
                  disabled={transition.isPending}
                  className="cursor-pointer bg-[var(--success-600)] text-white hover:bg-[var(--success-700)]"
                >
                  <Trophy className="mr-1.5 h-4 w-4" /> Completar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Quick stats — at-a-glance metrics under the header */}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-4">
          <Stat
            icon={Calendar}
            label="Inicio"
            value={startTime.toLocaleString('es-EC', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          />
          <Stat icon={Clock} label="Duración" value={duration} mono />
          <Stat
            icon={Wrench}
            label="Servicios"
            value={itemsCount > 0 ? String(itemsCount) : '—'}
            mono
          />
          <Stat icon={Receipt} label="Total" value={fmt(total)} mono emphasis />
        </dl>
      </header>

      {/* Payment-pending banner — service done, money still missing.
          This is the loudest signal staff need at the counter so they
          collect before the customer walks away with the car. */}
      {showPaymentPendingBanner && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--warning-200)] bg-[var(--warning-50)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--warning-100)] text-[var(--warning-700)]">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--warning-800)]">
                Servicio terminado · pago pendiente
              </p>
              <p className="mt-0.5 text-[12.5px] text-[var(--warning-700)]">
                Cobra al cliente antes de entregar el vehículo o servicio.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setPaymentOpen(true)}
            className="cursor-pointer bg-[var(--warning-600)] text-white hover:bg-[var(--warning-700)]"
          >
            <Wallet className="mr-1.5 h-4 w-4" /> Registrar pago
          </Button>
        </div>
      )}

      {/* ─── Main grid: items + history on the left, customer/total sidebar on the right ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Items */}
          <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
                <h2 className="text-[14px] font-semibold text-[var(--fg-strong)]">
                  Items{itemsCount > 0 && (
                    <span className="ml-1.5 text-[12px] font-normal text-[var(--fg-muted)]">
                      ({itemsCount})
                    </span>
                  )}
                </h2>
              </div>
              {isEditable && (
                <Button size="sm" onClick={() => setAddOpen(true)} className="cursor-pointer">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar
                </Button>
              )}
            </div>

            {!items?.length ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-sunken)]">
                  <Package className="h-5 w-5 text-[var(--fg-muted)]" aria-hidden="true" />
                </div>
                <p className="text-[13px] font-medium text-[var(--fg-strong)]">Sin items aún</p>
                {isEditable && (
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    Agrega un servicio o producto para comenzar.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:px-5"
                  >
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        it.itemType === 'service_variant'
                          ? 'bg-[var(--info-50)] text-[var(--info-700)]'
                          : 'bg-[var(--success-50)] text-[var(--success-700)]',
                      )}
                    >
                      {it.itemType === 'service_variant' ? 'Servicio' : 'Producto'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-[var(--fg-strong)]">
                        {it.label}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)] sm:hidden">
                        <span
                          className="font-mono tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {fmt(it.unitPrice)} × {it.qty}
                        </span>
                      </p>
                    </div>
                    <span
                      className="hidden font-mono text-[12.5px] tabular-nums text-[var(--fg-muted)] sm:inline"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      ×{it.qty}
                    </span>
                    <span
                      className="hidden w-24 text-right font-mono text-[13px] tabular-nums text-[var(--fg-secondary)] sm:inline-block"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {fmt(it.unitPrice)}
                    </span>
                    <div className="flex items-center gap-3 sm:gap-2">
                      <span
                        className="w-24 text-right font-mono text-[14px] font-semibold tabular-nums text-[var(--fg-strong)]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {fmt(it.lineTotal)}
                      </span>
                      <div className="flex gap-0.5">
                        {isEditable && it.itemType === 'service_variant' && it.serviceId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--brand-700)]"
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
                            className="h-8 w-8 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--brand-700)]"
                            onClick={() => {
                              setOverrideTarget(it);
                              setOverridePrice(String(it.unitPrice));
                              setOverrideReason('');
                              setOverrideNote('');
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
                            className="h-8 w-8 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--danger-50)] hover:text-[var(--danger-600)]"
                            onClick={() => setRemoveTarget(it)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Billing snapshot */}
          {reservation.billingSnapshot && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
                  <h2 className="text-[14px] font-semibold text-[var(--fg-strong)]">Facturación</h2>
                </div>
                <span className="text-[11px] text-[var(--fg-muted)]">
                  Capturado{' '}
                  {new Date(reservation.billingSnapshot.capturedAt).toLocaleString('es-EC', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                <BillingRow
                  label="Documento"
                  value={
                    <span className="font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      {reservation.billingSnapshot.docType.toUpperCase()} ·{' '}
                      {reservation.billingSnapshot.docNumber}
                    </span>
                  }
                />
                <BillingRow
                  label="Razón social"
                  value={
                    <strong className="text-[var(--fg-strong)]">
                      {reservation.billingSnapshot.legalName}
                    </strong>
                  }
                />
                {reservation.billingSnapshot.email && (
                  <BillingRow label="Email" value={reservation.billingSnapshot.email} />
                )}
                {reservation.billingSnapshot.address && (
                  <BillingRow label="Dirección" value={reservation.billingSnapshot.address} />
                )}
              </dl>
            </section>
          )}

          {/* History — compact when empty, full timeline when populated */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
              <h2 className="text-[14px] font-semibold text-[var(--fg-strong)]">
                Historial de cambios
                {changes?.length ? (
                  <span className="ml-1.5 text-[12px] font-normal text-[var(--fg-muted)]">
                    ({changes.length})
                  </span>
                ) : null}
              </h2>
            </div>
            {!changes?.length ? (
              <p className="text-[12.5px] text-[var(--fg-muted)]">Sin cambios registrados.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-[var(--border)] pl-4 text-[12.5px]">
                {changes.map((c) => (
                  <li key={c.id} className="relative">
                    <span
                      className="absolute -left-[19px] top-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--brand-400)]"
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-center gap-x-2 text-[var(--fg-strong)]">
                      <strong>{ACTION_LABEL[c.action] ?? c.action}</strong>
                      {c.label && <span className="font-normal">{c.label}</span>}
                      {c.action === 'price_override' && (
                        <span
                          className="font-mono text-[var(--fg-muted)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {fmt(c.oldPrice ?? 0)} → {fmt(c.newPrice ?? 0)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                      {c.changedAt.toLocaleString('es-EC', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {c.changedBy && <> · {c.changedBy.name}</>}
                      {c.reason && <> · &ldquo;{c.reason}&rdquo;</>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* ─── Sidebar ─── */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {/* Total card — big number, easy to scan from across the room */}
          <section className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-app)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              Total
            </p>
            <p
              className="mt-1 font-mono text-[32px] font-bold leading-none tracking-tight tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {fmt(total)}
            </p>
            {itemsCount > 0 && (
              <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
                {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
              </p>
            )}
          </section>

          {/* Pago card — independent of lifecycle status. Either we
              already have a receipt (paid + method + when + reference)
              or we surface the CTA so the cashier can register it. */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                Pago
              </h3>
              {isPaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-700)]">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Pagado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fg-secondary)]">
                  Pendiente
                </span>
              )}
            </div>

            {isPaid && reservation.paymentMethod ? (
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--fg-muted)]">Método</dt>
                  <dd className="flex items-center gap-1.5 font-semibold text-[var(--fg-strong)]">
                    {(() => {
                      const Icon = PAYMENT_METHOD_ICON[reservation.paymentMethod];
                      return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
                    })()}
                    {PAYMENT_METHOD_LABEL[reservation.paymentMethod]}
                  </dd>
                </div>
                {reservation.paymentMethod === 'transfer' && (() => {
                  const b = findBank(reservation.paymentBank);
                  return b ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[var(--fg-muted)]">Banco</dt>
                      <dd className="flex items-center gap-1.5 font-semibold text-[var(--fg-strong)]">
                        <BankChip bank={b} size={20} />
                        {b.name.replace(/^Banco\s/, '')}
                      </dd>
                    </div>
                  ) : null;
                })()}
                {reservation.paidAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Cobrado</dt>
                    <dd
                      className="font-mono tabular-nums text-[var(--fg-secondary)]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {reservation.paidAt.toLocaleString('es-EC', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </dd>
                  </div>
                )}
                {reservation.paymentReference && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-2.5">
                    <dt className="shrink-0 text-[var(--fg-muted)]">Ref.</dt>
                    <dd
                      className="truncate text-right font-mono text-[12.5px] text-[var(--fg-secondary)]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      title={reservation.paymentReference}
                    >
                      {reservation.paymentReference}
                    </dd>
                  </div>
                )}
              </dl>
            ) : canRecordPayment ? (
              <Button
                size="sm"
                onClick={() => setPaymentOpen(true)}
                className="w-full cursor-pointer"
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Registrar pago
              </Button>
            ) : (
              <p className="text-[12.5px] text-[var(--fg-muted)]">
                Sin pago registrado.
              </p>
            )}
          </section>

          {/* Cliente card */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              Cliente
            </h3>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink-75)] text-[13px] font-semibold text-[var(--fg-strong)]">
                {getInitials(reservation.client?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--fg-strong)]">
                  {reservation.client?.name ?? '—'}
                </p>
                {reservation.client?.email && (
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--fg-secondary)]">
                    <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <a
                      href={`mailto:${reservation.client.email}`}
                      className="truncate hover:text-[var(--brand-700)] hover:underline"
                    >
                      {reservation.client.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Vehículo / recurso card */}
          {hasResource && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                <Car className="h-3.5 w-3.5" aria-hidden="true" />
                Vehículo
              </h3>
              <p className="text-[14px] font-semibold text-[var(--fg-strong)]">
                {reservation.clientResource?.brand} {reservation.clientResource?.model}
              </p>
              <p
                className="mt-1 font-mono text-[13px] tabular-nums text-[var(--fg-secondary)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {reservation.clientResource?.plate}
              </p>
            </section>
          )}

          {/* Horario card */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Horario
            </h3>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--fg-muted)]">Inicio</dt>
                <dd
                  className="font-mono font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {startTime.toLocaleString('es-EC', { timeStyle: 'short' })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--fg-muted)]">Fin estimado</dt>
                <dd
                  className="font-mono tabular-nums text-[var(--fg-secondary)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {endTime.toLocaleString('es-EC', { timeStyle: 'short' })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-2.5">
                <dt className="text-[var(--fg-muted)]">Duración</dt>
                <dd className="font-semibold text-[var(--fg-strong)]">{duration}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <CheckInModal
        open={checkInOpen}
        reservationId={id}
        defaultEmail={reservation.client?.email}
        defaultName={reservation.client?.name}
        defaultProfile={reservation.client?.defaultBillingProfile}
        onClose={() => setCheckInOpen(false)}
        onSuccess={() => setCheckInOpen(false)}
      />

      <PaymentModal
        open={paymentOpen}
        reservationId={id}
        total={total}
        defaultEmail={reservation.client?.email}
        defaultName={reservation.client?.name}
        defaultProfile={reservation.client?.defaultBillingProfile}
        currentBilling={reservation.billingSnapshot}
        onClose={() => setPaymentOpen(false)}
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
            {/* Lista cerrada, no texto libre: el reporte de descuentos agrupa
                por este código, y "cliente especial" escrito a mano no se
                agrupa con nada. Acá el motivo lo exige a todos, tenga o no el
                privilegio Precio — retocar una reserva ya confirmada es un
                desvío por definición. */}
            <div className="space-y-2 rounded-lg border border-[var(--warning-200)] bg-[var(--warning-50)] p-3">
              <Label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                Motivo del ajuste
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_CHANGE_REASONS.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => {
                      setOverrideReason(r.code);
                      // Una nota escrita bajo "Otro" no debe viajar en
                      // silencio si el cajero cambia de motivo después.
                      if (r.code !== REASON_REQUIRES_NOTE) setOverrideNote('');
                    }}
                    aria-pressed={overrideReason === r.code}
                    className={cn(
                      'cursor-pointer rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors',
                      overrideReason === r.code
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sunken)]',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {overrideReason === REASON_REQUIRES_NOTE && (
                <input
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  maxLength={200}
                  placeholder="¿De qué se trata?"
                  aria-label="Detalle del motivo"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[14px]"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancelar</Button>
            <Button
              onClick={doOverride}
              disabled={
                override.isPending ||
                !overrideReason ||
                (overrideReason === REASON_REQUIRES_NOTE && !overrideNote.trim())
              }
            >
              Guardar
            </Button>
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
