'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { cn } from '@/shared/utils/cn';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { useMyReservation, useCancelMyReservation } from '@/presentation/hooks/use-client-portal';
import { CANCEL_REASONS, canCancel } from '@/domain/entities/client-reservation';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

export default function ClientReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: reservation, isLoading } = useMyReservation(id);
  const cancelMutation = useCancelMyReservation();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] text-[var(--fg-secondary)]">No encontramos esta reserva.</p>
        <Button variant="link" onClick={() => router.push('/app/reservas')}>
          Volver a mis reservas
        </Button>
      </div>
    );
  }

  const cancellable = canCancel(reservation);
  const lines =
    reservation.items.length > 0
      ? reservation.items
      : reservation.service
        ? [{ id: 'svc', label: reservation.service.name, qty: 1, lineTotal: reservation.service.price }]
        : [];

  function handleCancel() {
    cancelMutation.mutate(
      { id, reason },
      {
        onSuccess: () => {
          toast.success('Reserva cancelada');
          setConfirmOpen(false);
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'No se pudo cancelar la reserva')),
      },
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/app/reservas')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Mis reservas
      </Button>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h1
          className="text-[22px] font-bold leading-tight text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {reservation.business?.name ?? 'Negocio'}
        </h1>

        <p className="mt-2 flex items-center gap-2 text-[14px] text-[var(--fg)]">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
          {format(reservation.scheduledAt, "EEEE d 'de' MMMM · HH:mm", { locale: es })}
        </p>

        {reservation.resourceLabel && (
          <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-[var(--fg-secondary)]">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
            {reservation.resourceLabel}
          </p>
        )}

        {reservation.status === 'cancelled' && (
          <p className="mt-3 rounded-lg bg-[var(--danger-50)] px-3 py-2 text-[13px] text-[var(--danger-700)]">
            Cancelada{reservation.cancelReason ? `: ${reservation.cancelReason}` : ''}
          </p>
        )}
      </section>

      {lines.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Detalle
          </h2>
          <ul className="mt-3 space-y-2">
            {lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate text-[var(--fg)]">
                  {line.label}
                  {line.qty > 1 && (
                    <span className="text-[var(--fg-muted)]"> × {line.qty}</span>
                  )}
                </span>
                <span
                  className="shrink-0 tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {money(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-[var(--border)] pt-3">
            <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Total
            </span>
            <span
              className="text-[19px] font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {money(reservation.total)}
            </span>
          </div>
        </section>
      )}

      {cancellable ? (
        <Button
          variant="outline"
          className="w-full text-[var(--danger-700)]"
          onClick={() => setConfirmOpen(true)}
        >
          Cancelar reserva
        </Button>
      ) : (
        reservation.status === 'confirmed' || reservation.status === 'pending' ? (
          <p className="px-1 text-center text-[12.5px] text-[var(--fg-muted)]">
            Ya no puedes cancelar en línea: faltan menos de{' '}
            {reservation.business?.cancellationHours ?? 1} h. Comunícate con el negocio.
          </p>
        ) : null
      )}

      {reservation.business?.slug && (
        <Button asChild variant="ghost" className="w-full">
          <Link href={`/${reservation.business.slug}`}>Ver el negocio</Link>
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar reserva</DialogTitle>
            <DialogDescription>Cuéntanos el motivo para avisar al negocio.</DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5">
            {CANCEL_REASONS.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left text-[14px] transition-colors',
                    reason === r
                      ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--fg-strong)]'
                      : 'border-[var(--border)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Volver
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-[var(--danger-700)] hover:bg-[var(--danger-700)]/90"
            >
              {cancelMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
