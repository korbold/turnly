'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Search, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { Calendar } from '@/presentation/components/ui/calendar';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { useServices } from '@/presentation/hooks/use-services';
import {
  useAvailableSlots,
  useCreateReservation,
} from '@/presentation/hooks/use-reservations';
import { useClients } from '@/presentation/hooks/use-clients';
import { useTeam } from '@/presentation/hooks/use-team';
import type { Service } from '@/domain/entities/service';

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
}

const STEP_TITLES = [
  'Seleccionar Servicio',
  'Fecha y Hora',
  'Cliente / Recurso',
  'Confirmar',
];

export function CreateModal({ open, onClose }: CreateModalProps) {
  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedClientResourceId, setSelectedClientResourceId] = useState<
    string | null
  >(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  // Data hooks
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    dateStr,
    selectedService?.id
  );
  const { data: clientsData, isLoading: clientsLoading } = useClients(
    1,
    clientSearch || undefined
  );
  const { data: teamData } = useTeam();
  const createMutation = useCreateReservation();

  const services = servicesData?.data ?? [];
  const slots = slotsData ?? [];
  const clients = clientsData?.data ?? [];
  const team = teamData?.data ?? [];

  function handleClose() {
    setStep(0);
    setSelectedService(null);
    setSelectedDate(new Date());
    setSelectedSlot(null);
    setSelectedClientResourceId(null);
    setAssignedTo('');
    setNotes('');
    setClientSearch('');
    onClose();
  }

  function handleSubmit() {
    if (!selectedClientResourceId || !selectedService || !selectedSlot) return;

    createMutation.mutate(
      {
        clientResourceId: selectedClientResourceId,
        serviceId: selectedService.id,
        scheduledAt: selectedSlot,
        assignedTo: assignedTo || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Reserva creada');
          handleClose();
        },
        onError: () => toast.error('Error al crear la reserva'),
      }
    );
  }

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return !!selectedService;
      case 1:
        return !!selectedSlot;
      case 2:
        return !!selectedClientResourceId;
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, selectedService, selectedSlot, selectedClientResourceId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogDescription>
            Paso {step + 1} de 4 &mdash; {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full',
                i <= step ? 'bg-indigo-500' : 'bg-zinc-200'
              )}
            />
          ))}
        </div>

        {/* Step 1: Select service */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {servicesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))
              : services
                  .filter((s) => s.isActive)
                  .map((svc) => (
                    <Card
                      key={svc.id}
                      className={cn(
                        'cursor-pointer transition-all',
                        selectedService?.id === svc.id
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'hover:border-zinc-300'
                      )}
                      onClick={() => setSelectedService(svc)}
                    >
                      <CardContent className="flex items-center gap-2 p-3">
                        {selectedService?.id === svc.id && (
                          <Check className="h-4 w-4 shrink-0 text-indigo-500" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {svc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Intl.NumberFormat('es-CO', {
                              style: 'currency',
                              currency: 'COP',
                              minimumFractionDigits: 0,
                            }).format(svc.price)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
          </div>
        )}

        {/* Step 2: Date + Time slot */}
        {step === 1 && (
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d ?? undefined);
                setSelectedSlot(null);
              }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />

            <div>
              <p className="mb-2 text-sm font-medium">Horarios disponibles</p>
              {slotsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-20 rounded-md" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay horarios disponibles para esta fecha
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const isoStr = new Date(slot.start).toISOString();
                    const isSelected = selectedSlot === isoStr;
                    return (
                      <Button
                        key={isoStr}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className="h-8"
                        onClick={() => setSelectedSlot(isoStr)}
                      >
                        {format(new Date(slot.start), 'HH:mm')}
                        {slot.available > 0 && (
                          <Badge
                            variant="secondary"
                            className="ml-1 text-[10px]"
                          >
                            {slot.available}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Client resource */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por placa, nombre..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>

            {clientsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No se encontraron resultados
              </p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {clients.map((cr) => (
                  <button
                    key={cr.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                      selectedClientResourceId === cr.id
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-200'
                        : 'hover:bg-zinc-50'
                    )}
                    onClick={() => setSelectedClientResourceId(cr.id)}
                  >
                    {selectedClientResourceId === cr.id && (
                      <Check className="h-4 w-4 shrink-0 text-indigo-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {cr.plate ?? cr.client?.name ?? 'Sin identificar'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[cr.brand, cr.model, cr.color]
                          .filter(Boolean)
                          .join(' - ') || cr.client?.email || ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Assign employee + notes + confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Asignar empleado (opcional)
              </label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {team.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Notas (opcional)
              </label>
              <Textarea
                placeholder="Instrucciones especiales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-zinc-50 p-4 text-sm">
              <h4 className="mb-2 font-semibold">Resumen</h4>
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Servicio:</span>{' '}
                  {selectedService?.name}
                </p>
                <p>
                  <span className="font-medium text-foreground">Fecha:</span>{' '}
                  {selectedSlot
                    ? format(new Date(selectedSlot), "d 'de' MMMM yyyy, HH:mm", {
                        locale: es,
                      })
                    : '-'}
                </p>
                <p>
                  <span className="font-medium text-foreground">Precio:</span>{' '}
                  {selectedService
                    ? new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        minimumFractionDigits: 0,
                      }).format(selectedService.price)
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Atras
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              Crear Reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
