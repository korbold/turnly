'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
  TurnstileWidget,
  isTurnstileEnabled,
} from '@/presentation/components/features/security/turnstile-widget';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Calendar } from '@/presentation/components/ui/calendar';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { cn } from '@/shared/utils/cn';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { PublicTenant, BookingData } from '@/domain/repositories/public.repository';

interface BookingFlowProps {
  slug: string;
  tenant: PublicTenant;
  initialServiceId?: string;
  primaryColor?: string;
}

type Step = 1 | 2 | 3 | 4;

export function BookingFlow({ slug, tenant, initialServiceId, primaryColor = '#F2693A' }: BookingFlowProps) {
  const repo = useRepository('public');
  const [step, setStep] = useState<Step>(initialServiceId ? 2 : 1);
  const [serviceId, setServiceId] = useState(initialServiceId ?? '');
  // Starts on today so the customer lands on a populated slot list
  // instead of an empty panel.
  const [date, setDate] = useState<Date | undefined>(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [customData, setCustomData] = useState<Record<string, string>>({});
  const [reservationId, setReservationId] = useState('');

  const dateStr = date ? format(date, 'yyyy-MM-dd') : '';

  const { data: slots, isLoading: slotsLoading, isError: slotsError } = useQuery({
    queryKey: ['public', 'slots', slug, serviceId, dateStr],
    queryFn: () => repo.getAvailableSlots(slug, serviceId, dateStr),
    enabled: !!serviceId && !!dateStr,
  });

  const bookMutation = useMutation({
    mutationFn: (data: BookingData) => repo.book(slug, data),
    onSuccess: (result) => {
      setReservationId(result.reservationId);
      setStep(4);
    },
  });

  const selectedService = tenant.services.find((s) => s.id === serviceId);

  function handleBack() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function handleSelectService(id: string) {
    setServiceId(id);
    setStep(2);
  }

  function handleSelectSlot(slotStart: string) {
    setSelectedSlot(slotStart);
    setStep(3);
  }

  function handleSubmit() {
    if (!serviceId || !selectedSlot || !name || !email || !phone) return;
    bookMutation.mutate({
      serviceId,
      scheduledAt: selectedSlot,
      name,
      email: email.trim().toLowerCase(),
      phone,
      turnstileToken,
      resourceData: customData,
    });
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                step >= s ? 'text-white' : 'border border-zinc-300 text-zinc-400'
              )}
              style={step >= s ? { backgroundColor: primaryColor } : {}}
            >
              {step > s ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 4 && <div className={cn('h-0.5 w-6', step > s ? 'bg-[var(--color-primary)]' : 'bg-zinc-200')} style={step > s ? { backgroundColor: primaryColor } : {}} />}
          </div>
        ))}
      </div>

      {step > 1 && step < 4 && (
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </button>
      )}

      {/* Step 1: Select service */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Selecciona un servicio</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tenant.services.map((svc) => (
              <Card
                key={svc.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  serviceId === svc.id && 'ring-2'
                )}
                style={serviceId === svc.id ? { borderColor: primaryColor } : {}}
                onClick={() => handleSelectService(svc.id)}
              >
                <CardContent className="p-4">
                  {svc.imageUrl && (
                    <img src={svc.imageUrl} alt={svc.name} className="mb-2 h-24 w-full rounded-md object-cover" />
                  )}
                  <h4 className="font-medium">{svc.name}</h4>
                  {svc.description && <p className="mt-0.5 text-xs text-muted-foreground">{svc.description}</p>}
                  <p className="mt-1 font-semibold" style={{ color: primaryColor }}>${svc.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Date + slot */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Elige fecha y hora</h3>
          {selectedService && (
            <p className="text-sm text-muted-foreground">
              Servicio: <span className="font-medium text-foreground">{selectedService.name}</span>
            </p>
          )}
          <div className="flex flex-col gap-4 md:flex-row">
            {/* The API refuses any date before today, so offering past
                days led to a failed request and an empty panel with no
                explanation. */}
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={es}
              startMonth={new Date()}
              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            />
            <div className="flex-1">
              {!date && <p className="text-sm text-muted-foreground">Selecciona una fecha</p>}
              {date && slotsLoading && <p className="text-sm text-muted-foreground">Cargando horarios...</p>}
              {date && slotsError && (
                <p className="text-sm text-[var(--danger-700)]">
                  No pudimos cargar los horarios. Elige otra fecha o intenta de nuevo.
                </p>
              )}
              {date && !slotsError && slots && slots.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha</p>
              )}
              {date && !slotsError && slots && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const time = format(new Date(slot.start), 'HH:mm');
                    const slotStr = new Date(slot.start).toISOString();
                    const isSelected = selectedSlot === slotStr;
                    return (
                      <button
                        key={slotStr}
                        onClick={() => handleSelectSlot(slotStr)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                          isSelected ? 'text-white' : 'hover:border-[var(--color-primary)]/40'
                        )}
                        style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Customer data */}
      {step === 3 && (
        <div className="max-w-md space-y-4">
          <h3 className="text-lg font-semibold">Tus datos</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Correo</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
              <p className="text-[12px] text-[var(--fg-muted)]">
                Ahí te llega la confirmación y con él entras a ver tus reservas.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593 99 123 4567" />
            </div>

            {/* Custom fields */}
            {tenant.customFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}{field.required && <span className="text-rose-500"> *</span>}</Label>
                {field.type === 'select' ? (
                  <Select value={customData[field.key] ?? ''} onValueChange={(v) => setCustomData((d) => ({ ...d, [field.key]: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'textarea' ? (
                  <Textarea
                    value={customData[field.key] ?? ''}
                    onChange={(e) => setCustomData((d) => ({ ...d, [field.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={customData[field.key] ?? ''}
                    onChange={(e) => setCustomData((d) => ({ ...d, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>

          <TurnstileWidget onToken={setTurnstileToken} />

          <Button
            className="w-full"
            style={{ backgroundColor: primaryColor }}
            disabled={
              !name ||
              !email ||
              !phone ||
              bookMutation.isPending ||
              (isTurnstileEnabled() && !turnstileToken)
            }
            onClick={handleSubmit}
          >
            {bookMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Reservando...
              </>
            ) : (
              'Confirmar Reserva'
            )}
          </Button>

          {bookMutation.isError && (
            <p className="text-sm text-rose-600">Error al crear la reserva. Intenta de nuevo.</p>
          )}
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="flex flex-col items-center py-8 text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <Check className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold">Reserva Confirmada!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu reserva ha sido creada exitosamente
          </p>
          {reservationId && (
            <p className="mt-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-mono">
              Codigo: {reservationId}
            </p>
          )}
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setStep(1);
              setServiceId('');
              setDate(undefined);
              setSelectedSlot('');
              setName('');
              setPhone('');
              setCustomData({});
              setReservationId('');
            }}
          >
            Nueva Reserva
          </Button>
        </div>
      )}
    </div>
  );
}
