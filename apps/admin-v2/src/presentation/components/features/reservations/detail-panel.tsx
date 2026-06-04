'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, CheckCircle2, MoreHorizontal, Play, Trophy, UserX, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/presentation/components/ui/sheet';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { Separator } from '@/presentation/components/ui/separator';
import {
  useTransitionReservation,
  useCancelReservation,
  useRescheduleReservation,
  useAvailableSlots,
} from '@/presentation/hooks/use-reservations';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useSettings } from '@/presentation/hooks/use-settings';
import { CheckInModal } from '@/presentation/components/features/reservations/check-in-modal';
import {
  RESERVATION_STATUS_CONFIG,
} from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';
import type { Reservation } from '@/domain/entities/reservation';

interface DetailPanelProps {
  reservation: Reservation | null;
  open: boolean;
  onClose: () => void;
  /**
   * When true, render as an inline master-detail card (no Sheet wrapper,
   * no backdrop) so the timeline next to it stays interactive. Used by
   * the desktop layout. On smaller viewports we keep the Sheet because a
   * sliding overlay fits the touch ergonomics better.
   */
  embedded?: boolean;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function DetailPanel({ reservation, open, onClose, embedded = false }: DetailPanelProps) {
  const transition = useTransitionReservation();
  const cancel = useCancelReservation();
  const { data: settings } = useSettings();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const reschedule = useRescheduleReservation();
  const { data: rescheduleSlots, isLoading: rescheduleSlotsLoading } = useAvailableSlots(
    rescheduleOpen && rescheduleDate ? rescheduleDate : undefined,
    rescheduleOpen ? reservation?.serviceId : undefined,
  );

  if (!reservation) return null;

  const statusCfg = RESERVATION_STATUS_CONFIG[reservation.status];

  function handleTransition(action: 'confirm' | 'start' | 'complete') {
    transition.mutate(
      { id: reservation!.id, action },
      {
        onSuccess: () => {
          toast.success(
            action === 'confirm'
              ? 'Reserva confirmada'
              : action === 'start'
              ? 'Servicio iniciado'
              : 'Servicio completado'
          );
          onClose();
        },
        onError: () => toast.error('Error al actualizar la reserva'),
      }
    );
  }

  function handleCancel() {
    if (!cancelReason.trim()) return;
    cancel.mutate(
      { id: reservation!.id, reason: cancelReason },
      {
        onSuccess: () => {
          toast.success('Reserva cancelada');
          setCancelOpen(false);
          setCancelReason('');
          onClose();
        },
        onError: () => toast.error('Error al cancelar'),
      }
    );
  }

  function openReschedule() {
    if (!reservation) return;
    // Seed with the current booking's date so staff usually just nudges
    // the day; slots load automatically via useAvailableSlots.
    const d = new Date(reservation.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    setRescheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setRescheduleOpen(true);
  }

  function handleReschedule(slotStart: Date) {
    if (!reservation) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso =
      `${slotStart.getFullYear()}-${pad(slotStart.getMonth() + 1)}-${pad(slotStart.getDate())} ` +
      `${pad(slotStart.getHours())}:${pad(slotStart.getMinutes())}:00`;
    reschedule.mutate(
      { id: reservation.id, scheduledAt: iso },
      {
        onSuccess: () => {
          toast.success('Reserva reagendada');
          setRescheduleOpen(false);
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo reagendar');
        },
      }
    );
  }

  function handleNoShow() {
    transition.mutate(
      { id: reservation!.id, action: 'no_show' },
      {
        onSuccess: () => {
          toast.success('Marcada como ausente');
          onClose();
        },
        onError: () => toast.error('Error al marcar ausente'),
      }
    );
  }

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-[var(--fg-strong)]">
            Reserva #{reservation.id.slice(0, 8)}
          </h2>
          <Badge
            className={cn(
              'border-0 text-xs',
              statusCfg.bgColor,
              statusCfg.color
            )}
          >
            {statusCfg.label}
          </Badge>
        </div>
        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
          Detalle de la reserva
        </p>
        <a
          href={`/reservations/${reservation.id}`}
          className="mt-2 inline-flex w-fit text-[12px] font-medium text-[var(--brand-700)] hover:underline"
        >
          Abrir vista completa →
        </a>
      </div>
      {embedded && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 shrink-0 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)]"
          aria-label="Cerrar detalle"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const body = (
    <div className={cn('space-y-5', embedded ? 'mt-4' : 'mt-6')}>
            {/* Actions — one tap-friendly primary CTA per state; alternative
                paths sit as outlined secondaries; destructive / no-show land
                in the overflow menu so they don't compete for attention. */}
            {reservation.status !== 'completed' &&
              reservation.status !== 'cancelled' &&
              reservation.status !== 'no_show' && (
                <div className="flex items-stretch gap-2">
                  {reservation.status === 'pending' && (
                    <Button
                      className="h-11 flex-1 gap-2 bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:scale-[0.98] transition-all"
                      onClick={() => handleTransition('confirm')}
                      disabled={transition.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar cita
                    </Button>
                  )}

                  {reservation.status === 'confirmed' && (
                    <>
                      <Button
                        className="h-11 flex-1 gap-2 bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:scale-[0.98] transition-all"
                        onClick={() => setCheckInOpen(true)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar llegada
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 gap-2"
                        onClick={() => handleTransition('start')}
                        disabled={transition.isPending}
                        aria-label="Iniciar servicio sin check-in"
                      >
                        <Play className="h-4 w-4" />
                        Iniciar
                      </Button>
                    </>
                  )}

                  {reservation.status === 'checked_in' && (
                    <Button
                      className="h-11 flex-1 gap-2 bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
                      onClick={() => handleTransition('start')}
                      disabled={transition.isPending}
                    >
                      <Play className="h-4 w-4" />
                      Iniciar servicio
                    </Button>
                  )}

                  {reservation.status === 'in_progress' && (
                    <Button
                      className="h-11 flex-1 gap-2 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98] transition-all"
                      onClick={() => handleTransition('complete')}
                      disabled={transition.isPending}
                    >
                      <Trophy className="h-4 w-4" />
                      Completar
                    </Button>
                  )}

                  {reservation.status !== 'in_progress' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          aria-label="Más opciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {(reservation.status === 'pending' ||
                          reservation.status === 'confirmed') && (
                          <>
                            <DropdownMenuItem onClick={openReschedule}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              Reagendar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {(reservation.status === 'confirmed' ||
                          reservation.status === 'checked_in') && (
                          <>
                            <DropdownMenuItem
                              onClick={handleNoShow}
                              disabled={transition.isPending}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Marcar ausente
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => setCancelOpen(true)}
                          className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancelar reserva
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}

            <Separator />

            {/* Resource + Client */}
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cliente / Recurso
              </h4>
              {reservation.clientResource?.data &&
                Object.entries(reservation.clientResource.data as Record<string, unknown>).map(
                  ([key, val]) => {
                    if (!val) return null;
                    const customField = settings?.customFields?.find((f) => f.key === key);
                    const label = customField?.label ?? key;
                    return <InfoRow key={key} label={label} value={String(val)} />;
                  }
                )}
              {reservation.client?.name && (
                <InfoRow label="Creado por" value={reservation.client.name} />
              )}
              {reservation.client?.email && (
                <InfoRow label="Email" value={reservation.client.email} />
              )}
            </div>

            <Separator />

            {/* Service */}
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Servicio
              </h4>
              <InfoRow label="Nombre" value={reservation.service?.name} />
              <InfoRow label="Precio" value={reservation.service?.price} />
            </div>

            <Separator />

            {/* Time */}
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Horario
              </h4>
              <InfoRow
                label="Inicio"
                value={format(new Date(reservation.scheduledAt), "d MMM yyyy HH:mm", {
                  locale: es,
                })}
              />
              <InfoRow
                label="Fin estimado"
                value={format(new Date(reservation.estimatedEnd), "d MMM yyyy HH:mm", {
                  locale: es,
                })}
              />
            </div>

            {reservation.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notas
                  </h4>
                  <p className="text-sm">{reservation.notes}</p>
                </div>
              </>
            )}

            {reservation.cancelReason && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Motivo de cancelacion
                  </h4>
                  <p className="text-sm text-rose-600">
                    {reservation.cancelReason}
                  </p>
                </div>
              </>
            )}
    </div>
  );

  return (
    <>
      {embedded ? (
        // Master-detail: render as a sticky card next to the timeline. No
        // backdrop, no Sheet, so the surrounding view stays interactive.
        // Parent grid is responsible for visibility (hidden on mobile).
        <div
          className={cn(
            'rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5',
            'max-h-[calc(100dvh-2rem)] overflow-y-auto',
            // Subtle enter animation — slide in from the right edge of the
            // grid column. Exit is handled by the parent unmounting us.
            'animate-in fade-in slide-in-from-right-3 duration-200 ease-out',
          )}
        >
          {header}
          {body}
        </div>
      ) : (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-[400px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Reserva #{reservation.id.slice(0, 8)}
                <Badge
                  className={cn(
                    'border-0 text-xs',
                    statusCfg.bgColor,
                    statusCfg.color
                  )}
                >
                  {statusCfg.label}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Detalle de la reserva
              </SheetDescription>
              <a
                href={`/reservations/${reservation.id}`}
                className="mt-2 inline-flex w-fit text-[12px] font-medium text-[var(--brand-700)] hover:underline"
              >
                Abrir vista completa →
              </a>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      )}

      {reservation && (
        <CheckInModal
          open={checkInOpen}
          reservationId={reservation.id}
          defaultEmail={reservation.client?.email}
          defaultName={reservation.client?.name}
          onClose={() => setCheckInOpen(false)}
          onSuccess={() => {
            setCheckInOpen(false);
            onClose();
          }}
        />
      )}

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Reserva</DialogTitle>
            <DialogDescription>
              Por favor indica el motivo de la cancelacion.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo de cancelacion..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancel.isPending}
            >
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog — only reachable while pending or confirmed.
          Backend rejects checked_in / in_progress / terminal states.
          Loads real slots from the tenant's calendar so staff can only
          pick a time the service is actually open + nothing overlaps. */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar reserva</DialogTitle>
            <DialogDescription>
              Elige una fecha y luego un horario disponible. La duración se
              recalcula con los servicios actuales.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="reschedule-date"
                className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
              >
                Nueva fecha
              </Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Horarios disponibles
              </Label>
              {rescheduleSlotsLoading && (
                <p className="text-[13px] text-[var(--fg-secondary)]">
                  Cargando horarios…
                </p>
              )}
              {!rescheduleSlotsLoading &&
                (!rescheduleSlots || rescheduleSlots.length === 0) && (
                  <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-3 text-center text-[12px] text-[var(--fg-secondary)]">
                    No hay horarios disponibles para esa fecha.
                  </p>
                )}
              {!rescheduleSlotsLoading && rescheduleSlots && rescheduleSlots.length > 0 && (
                <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                  {rescheduleSlots.map((slot) => {
                    const time = format(slot.start, 'HH:mm');
                    return (
                      <button
                        key={slot.start.toISOString()}
                        type="button"
                        onClick={() => handleReschedule(slot.start)}
                        disabled={reschedule.isPending}
                        className={cn(
                          'rounded-md border border-[var(--border)] bg-[var(--bg-surface)]',
                          'px-3 py-1.5 text-[13px] font-medium tabular-nums text-[var(--fg-strong)]',
                          'transition-colors hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                        )}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleOpen(false)}
              disabled={reschedule.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
