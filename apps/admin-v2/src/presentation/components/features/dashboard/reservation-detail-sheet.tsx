'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Calendar, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/presentation/components/ui/sheet';
import { Button } from '@/presentation/components/ui/button';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import {
  useTransitionReservation,
  useCancelReservation,
  useReservationItems,
} from '@/presentation/hooks/use-reservations';
import { CheckInModal } from '@/presentation/components/features/reservations/check-in-modal';
import { useEffect, useState } from 'react';

function useIsDesktop(query = '(min-width: 640px)'): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return isDesktop;
}
import { RESERVATION_STATUS_CONFIG } from '@/shared/constants/status';
import type {
  Reservation,
  ReservationAction,
} from '@/domain/entities/reservation';
import { toast } from 'sonner';
import { cn } from '@/shared/utils/cn';

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ACTION_LABELS: Record<ReservationAction, string> = {
  confirm: 'Confirmar llegada',
  start: 'Iniciar servicio',
  complete: 'Completar',
  cancel: 'Cancelar',
  no_show: 'Marcar no-show',
};

function nextActions(status: Reservation['status']): ReservationAction[] {
  switch (status) {
    case 'pending':
      return ['confirm', 'cancel'];
    case 'confirmed':
      return ['start', 'cancel'];
    case 'in_progress':
      return ['complete'];
    case 'completed':
    case 'cancelled':
    case 'no_show':
      return [];
    default:
      return [];
  }
}

interface ReservationDetailSheetProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationDetailSheet({
  reservation,
  open,
  onOpenChange,
}: ReservationDetailSheetProps) {
  const router = useRouter();
  const transition = useTransitionReservation();
  const cancel = useCancelReservation();
  const isDesktop = useIsDesktop();
  const [checkInOpen, setCheckInOpen] = useState(false);
  // Phase 3 — pulled before the early return so the hooks list keeps
  // a stable shape across renders. The hook is gated by `enabled`
  // when the id is null so no extra request fires.
  const { data: items } = useReservationItems(reservation?.id ?? null);

  if (!reservation) return null;

  const cfg = RESERVATION_STATUS_CONFIG[reservation.status];
  const customer = reservation.client?.name ?? 'Cliente';
  const service = reservation.service?.name ?? 'Servicio';
  const start = format(new Date(reservation.scheduledAt), 'HH:mm');
  const end = format(new Date(reservation.estimatedEnd), 'HH:mm');
  const day = format(new Date(reservation.scheduledAt), "EEEE d 'de' MMMM", {
    locale: es,
  });

  const hasItems = (items?.length ?? 0) > 0;
  const itemsTotal = (items ?? []).reduce((acc, it) => acc + it.lineTotal, 0);
  const legacyPrice = Number(reservation.service?.price ?? 0);
  const totalAmount = hasItems ? itemsTotal : legacyPrice;
  const totalLabel = totalAmount > 0
    ? totalAmount.toLocaleString('es-EC', {
        style: 'currency',
        currency: 'USD',
      })
    : null;

  const actions = nextActions(reservation.status);
  const isPending = transition.isPending || cancel.isPending;

  function runAction(action: ReservationAction) {
    if (!reservation) return;
    if (action === 'cancel') {
      cancel.mutate(
        { id: reservation.id, reason: 'Cancelada desde dashboard' },
        {
          onSuccess: () => {
            toast.success('Reserva cancelada');
            onOpenChange(false);
          },
          onError: () => toast.error('No se pudo cancelar'),
        }
      );
      return;
    }
    // "Confirmar llegada" now triggers the full Phase 3 check-in: it
    // collects billing data + reserves BOM consumibles. Skips the
    // legacy plain `confirm` transition.
    if (action === 'confirm') {
      setCheckInOpen(true);
      return;
    }
    transition.mutate(
      { id: reservation.id, action },
      {
        onSuccess: () => {
          toast.success(ACTION_LABELS[action]);
          if (action === 'complete') onOpenChange(false);
        },
        onError: () => toast.error('No se pudo actualizar'),
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={
          isDesktop
            ? 'flex h-full w-full flex-col gap-0 overflow-y-auto p-8 sm:max-w-xl'
            : 'max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6'
        }
      >
        <SheetHeader className="text-left">
          <span
            className={cn(
              'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em]',
              cfg.bgColor,
              cfg.color
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', cfg.dotColor)}
              aria-hidden="true"
            />
            {cfg.label}
          </span>
          <SheetTitle className="text-[24px] font-bold leading-tight">
            {customer}
          </SheetTitle>
          <SheetDescription>{service}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3.5">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-[var(--ink-75)] text-[13px] font-semibold text-[var(--fg-strong)]">
                {getInitials(customer)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--fg-strong)]">
                {customer}
              </p>
              {reservation.client?.email && (
                <p className="truncate text-[12px] text-[var(--fg-secondary)]">
                  {reservation.client.email}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-[13px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Cuándo
              </dt>
              <dd
                className="mt-1 font-semibold tabular-nums text-[var(--fg-strong)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {start} <span className="text-[var(--fg-muted)]">{end}</span>
              </dd>
              <dd className="text-[12px] text-[var(--fg-secondary)] capitalize">
                {day}
              </dd>
            </div>
            {totalLabel && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Total
                </dt>
                <dd
                  className="mt-1 font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {totalLabel}
                </dd>
              </div>
            )}
          </dl>

          {hasItems && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Servicios ({items!.length})
              </p>
              <ul className="space-y-1.5">
                {items!.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-2 text-[13px] leading-snug"
                  >
                    <span className="flex-1 truncate text-[var(--fg-strong)]">
                      {it.label}
                    </span>
                    {it.qty !== 1 && (
                      <span
                        className="font-mono text-[12px] text-[var(--fg-muted)]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        x{it.qty}
                      </span>
                    )}
                    <span
                      className="w-20 text-right font-mono text-[var(--fg-strong)] tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {it.lineTotal.toLocaleString('es-EC', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reservation.notes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Notas
              </p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--fg)]">
                {reservation.notes}
              </p>
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          {actions.map((action) => (
            <Button
              key={action}
              size="lg"
              variant={action === 'cancel' ? 'outline' : 'default'}
              disabled={isPending}
              onClick={() => runAction(action)}
              className="w-full"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {ACTION_LABELS[action]}
            </Button>
          ))}
          <Button
            size="lg"
            variant="ghost"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              router.push(`/reservations?selectedId=${reservation.id}`);
            }}
          >
            <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
            Reagendar
          </Button>
        </div>
      </SheetContent>

      <CheckInModal
        open={checkInOpen}
        reservationId={reservation.id}
        defaultEmail={reservation.client?.email}
        defaultName={reservation.client?.name}
        onClose={() => setCheckInOpen(false)}
        onSuccess={() => {
          setCheckInOpen(false);
          onOpenChange(false);
        }}
      />
    </Sheet>
  );
}
