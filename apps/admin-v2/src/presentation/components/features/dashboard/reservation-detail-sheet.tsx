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
import { useTransitionReservation, useCancelReservation } from '@/presentation/hooks/use-reservations';
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

  if (!reservation) return null;

  const cfg = RESERVATION_STATUS_CONFIG[reservation.status];
  const customer = reservation.client?.name ?? 'Cliente';
  const service = reservation.service?.name ?? 'Servicio';
  const start = format(new Date(reservation.scheduledAt), 'HH:mm');
  const end = format(new Date(reservation.estimatedEnd), 'HH:mm');
  const day = format(new Date(reservation.scheduledAt), "EEEE d 'de' MMMM", {
    locale: es,
  });
  const price = reservation.service?.price;

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
        side="bottom"
        className="rounded-t-2xl sm:max-w-md sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
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

        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
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

          <dl className="grid grid-cols-2 gap-3 text-[13px]">
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
            {price && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Precio
                </dt>
                <dd
                  className="mt-1 font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {price}
                </dd>
              </div>
            )}
          </dl>

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

        <div className="mt-6 flex flex-col gap-2">
          {actions.map((action) => (
            <Button
              key={action}
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
    </Sheet>
  );
}
