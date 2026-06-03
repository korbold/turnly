'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { CheckCircle2, MoreHorizontal, Play, Trophy, UserX, X } from 'lucide-react';
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
} from '@/presentation/hooks/use-reservations';
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

export function DetailPanel({ reservation, open, onClose }: DetailPanelProps) {
  const transition = useTransitionReservation();
  const cancel = useCancelReservation();
  const { data: settings } = useSettings();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);

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

  return (
    <>
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

          <div className="mt-6 space-y-5">
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
                      onClick={() => setCheckInOpen(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar llegada
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
        </SheetContent>
      </Sheet>

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
    </>
  );
}
