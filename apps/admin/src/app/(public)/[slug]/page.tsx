'use client';

import { use, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getPublicTenant,
  getAvailableSlots,
  bookAppointment,
  type PublicService,
  type PublicAvailability,
  type AvailableSlot,
} from '@/lib/api/public';
import {
  MapPin,
  Phone,
  AtSign,
  Globe,
  MessageCircle,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------
const themeColors: Record<string, { gradient: string; button: string }> = {
  blue: { gradient: 'from-blue-600 to-blue-800', button: 'bg-blue-600 hover:bg-blue-700' },
  green: { gradient: 'from-green-600 to-green-800', button: 'bg-green-600 hover:bg-green-700' },
  red: { gradient: 'from-red-600 to-red-800', button: 'bg-red-600 hover:bg-red-700' },
  purple: { gradient: 'from-purple-600 to-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
  orange: { gradient: 'from-orange-600 to-orange-800', button: 'bg-orange-600 hover:bg-orange-700' },
  teal: { gradient: 'from-teal-600 to-teal-800', button: 'bg-teal-600 hover:bg-teal-700' },
  pink: { gradient: 'from-pink-600 to-pink-800', button: 'bg-pink-600 hover:bg-pink-700' },
  gray: { gradient: 'from-gray-600 to-gray-800', button: 'bg-gray-600 hover:bg-gray-700' },
};

const defaultTheme = themeColors.blue;

const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const dayAbbreviations = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate the next N days starting from today */
function getNextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Format date as YYYY-MM-DD */
function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Check if two dates are the same calendar day */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Format a time string like "09:00:00" to "9:00" */
function formatTime(t: string): string {
  const [h, m] = t.split(':');
  return `${parseInt(h, 10)}:${m}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BusinessPage({ params }: PageProps) {
  const { slug } = use(params);
  const bookingRef = useRef<HTMLDivElement>(null);

  // Booking state
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingStep, setBookingStep] = useState(1);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [clientForm, setClientForm] = useState<{ name: string; email: string; phone: string; custom: Record<string, string> }>({
    name: '',
    email: '',
    phone: '',
    custom: {},
  });
  const [bookingResult, setBookingResult] = useState<{ id: string } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-tenant', slug],
    queryFn: () => getPublicTenant(slug),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Error / 404
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-800">404</h1>
          <p className="text-gray-500">Negocio no encontrado</p>
        </div>
      </div>
    );
  }

  const { tenant, services, availability, images } = data;
  const theme = themeColors[tenant.brand_theme] ?? defaultTheme;

  function handleReservar(service: PublicService) {
    setSelectedService(service);
    setBookingStep(1);
    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setBookingResult(null);
    setBookingError(null);
    setClientForm({ name: '', email: '', phone: '', custom: {} });
    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  async function handleSelectDate(date: Date) {
    if (!selectedService) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setBookingStep(1);
    setSlotsLoading(true);
    try {
      const slots = await getAvailableSlots(slug, selectedService.id, formatDateISO(date));
      setAvailableSlots(slots);
      setBookingStep(2);
    } catch {
      setAvailableSlots([]);
      setBookingStep(2);
    } finally {
      setSlotsLoading(false);
    }
  }

  function handleSelectSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setBookingStep(3);
  }

  function handleClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBookingStep(4);
  }

  async function handleConfirmBooking() {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const scheduledAt = `${formatDateISO(selectedDate)}T${selectedSlot.start}`;
      const result = await bookAppointment(slug, {
        service_id: selectedService.id,
        scheduled_at: scheduledAt,
        client_name: clientForm.name,
        client_email: clientForm.email,
        client_phone: clientForm.phone || undefined,
        client_resource_data: Object.keys(clientForm.custom).length > 0 ? clientForm.custom : undefined,
      });
      setBookingResult(result);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al crear la reserva')
          : 'Error al crear la reserva';
      setBookingError(message);
    } finally {
      setBookingLoading(false);
    }
  }

  function handleResetBooking() {
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setBookingStep(1);
    setAvailableSlots([]);
    setBookingResult(null);
    setBookingError(null);
    setBookingLoading(false);
    setClientForm({ name: '', email: '', phone: '', custom: {} });
  }

  // Build schedule map: day_of_week -> list of time ranges
  const scheduleMap = new Map<number, PublicAvailability[]>();
  for (const slot of availability) {
    const existing = scheduleMap.get(slot.day_of_week) ?? [];
    existing.push(slot);
    scheduleMap.set(slot.day_of_week, existing);
  }

  const next14Days = getNextDays(14);
  const today = new Date();
  const customFields = tenant.custom_fields ?? [];

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* A) Header / Hero */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative">
        {tenant.cover_url ? (
          <div className="h-48 md:h-64 w-full overflow-hidden">
            <img
              src={tenant.cover_url}
              alt={`${tenant.name} cover`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`h-48 md:h-64 w-full bg-gradient-to-r ${theme.gradient}`} />
        )}

        {tenant.logo_url && (
          <div className="absolute bottom-0 left-4 translate-y-1/2">
            <img
              src={tenant.logo_url}
              alt={`${tenant.name} logo`}
              className="w-20 h-20 rounded-xl object-cover border-4 border-white shadow-md bg-white"
            />
          </div>
        )}
      </div>

      <div className={`px-4 md:px-8 max-w-5xl mx-auto ${tenant.logo_url ? 'pt-14' : 'pt-6'}`}>
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{tenant.name}</h1>
          <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600 capitalize">
            {tenant.business_type}
          </span>
        </div>

        {tenant.description && (
          <p className="mt-2 text-gray-600 max-w-2xl">{tenant.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {tenant.address && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {tenant.address}
            </span>
          )}
          {tenant.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {tenant.phone}
            </span>
          )}
        </div>

        {tenant.social_links && Object.keys(tenant.social_links).length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            {tenant.social_links.instagram && (
              <a
                href={tenant.social_links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-pink-500 transition-colors"
              >
                <AtSign className="h-5 w-5" />
              </a>
            )}
            {tenant.social_links.facebook && (
              <a
                href={tenant.social_links.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Globe className="h-5 w-5" />
              </a>
            )}
            {tenant.social_links.whatsapp && (
              <a
                href={tenant.social_links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-green-500 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* B) Gallery */}
      {/* ---------------------------------------------------------------- */}
      {images.length > 0 && (
        <section className="mt-8 px-4 md:px-8 max-w-5xl mx-auto">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {images.map((img) => (
              <img
                key={img.id}
                src={img.url}
                alt={img.caption ?? ''}
                className="w-[150px] h-[150px] rounded-lg object-cover flex-shrink-0"
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* C) Services */}
      {/* ---------------------------------------------------------------- */}
      {services.length > 0 && (
        <section className="mt-10 px-4 md:px-8 max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Servicios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                {service.image_url && (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                  )}
                  <p className="text-lg font-bold text-gray-900">
                    ${Number(service.price).toFixed(2)}
                  </p>
                  <button
                    onClick={() => handleReservar(service)}
                    className={`w-full text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors ${theme.button}`}
                  >
                    Reservar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* D) Schedule */}
      {/* ---------------------------------------------------------------- */}
      {availability.length > 0 && (
        <section className="mt-10 px-4 md:px-8 max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Horarios</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {dayNames.map((dayName, i) => {
                  const slots = scheduleMap.get(i);
                  return (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium text-gray-700">{dayName}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {slots
                          ? slots.map((s) => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`).join(', ')
                          : 'Cerrado'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* E) Booking section */}
      {/* ---------------------------------------------------------------- */}
      <div ref={bookingRef}>
        {selectedService && !bookingResult && (
          <section className="mt-10 mb-10 px-4 md:px-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Reservar</h2>
                <p className="text-gray-600">
                  {selectedService.name} &mdash;{' '}
                  <span className="font-semibold">${Number(selectedService.price).toFixed(2)}</span>
                </p>
              </div>

              {/* Step 1: Select date */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Selecciona una fecha</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {next14Days.map((day) => {
                    const dayOfWeek = (day.getDay() + 6) % 7; // JS Sunday=0 -> our Monday=0
                    const abbr = dayAbbreviations[dayOfWeek];
                    const isToday = isSameDay(day, today);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    return (
                      <button
                        key={formatDateISO(day)}
                        onClick={() => handleSelectDate(day)}
                        className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-sm transition-colors ${
                          isSelected
                            ? `${theme.button} text-white border-transparent`
                            : isToday
                              ? 'border-gray-400 bg-gray-50 text-gray-800'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xs font-medium">{abbr}</span>
                        <span className="text-lg font-bold">{day.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select time */}
              {bookingStep >= 2 && selectedDate && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Selecciona un horario</h3>
                  {slotsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      Cargando horarios...
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay horarios disponibles para esta fecha</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            onClick={() => handleSelectSlot(slot)}
                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                              isSelected
                                ? `${theme.button} text-white border-transparent`
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {formatTime(slot.start)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Client info */}
              {bookingStep >= 3 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tus datos</h3>
                  <form onSubmit={handleClientSubmit} className="space-y-3 max-w-md">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Nombre <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={clientForm.name}
                        onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Tu nombre completo"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={clientForm.email}
                        onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="tu@email.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={clientForm.phone}
                        onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 234 567 8900"
                      />
                    </div>

                    {/* Custom fields */}
                    {customFields.map((field) => (
                      <div key={field.key}>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            required={field.required}
                            value={clientForm.custom[field.key] ?? ''}
                            onChange={(e) =>
                              setClientForm((prev) => ({
                                ...prev,
                                custom: { ...prev.custom, [field.key]: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px] resize-y"
                            placeholder={field.label}
                          />
                        ) : field.type === 'select' ? (
                          <select
                            required={field.required}
                            value={clientForm.custom[field.key] ?? ''}
                            onChange={(e) =>
                              setClientForm((prev) => ({
                                ...prev,
                                custom: { ...prev.custom, [field.key]: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Seleccionar...</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            required={field.required}
                            value={clientForm.custom[field.key] ?? ''}
                            onChange={(e) =>
                              setClientForm((prev) => ({
                                ...prev,
                                custom: { ...prev.custom, [field.key]: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={field.label}
                          />
                        )}
                      </div>
                    ))}

                    {bookingStep === 3 && (
                      <button
                        type="submit"
                        className={`text-white text-sm font-medium py-2 px-6 rounded-lg transition-colors ${theme.button}`}
                      >
                        Continuar
                      </button>
                    )}
                  </form>
                </div>
              )}

              {/* Step 4: Confirmation */}
              {bookingStep >= 4 && selectedDate && selectedSlot && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Confirmar reserva</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm max-w-md">
                    <p>
                      <span className="text-gray-500">Servicio:</span>{' '}
                      <span className="font-medium">{selectedService.name}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Fecha:</span>{' '}
                      <span className="font-medium">
                        {selectedDate.toLocaleDateString('es', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">Hora:</span>{' '}
                      <span className="font-medium">{formatTime(selectedSlot.start)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Cliente:</span>{' '}
                      <span className="font-medium">{clientForm.name}</span>
                    </p>
                  </div>

                  {bookingError && (
                    <p className="mt-3 text-sm text-red-600">{bookingError}</p>
                  )}

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setBookingStep(3)}
                      className="text-sm font-medium py-2 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Volver
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      disabled={bookingLoading}
                      className={`text-white text-sm font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 ${theme.button}`}
                    >
                      {bookingLoading ? 'Reservando...' : 'Confirmar reserva'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Success state */}
        {bookingResult && (
          <section className="mt-10 mb-10 px-4 md:px-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 max-w-md mx-auto">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-gray-900">Reserva creada</h2>
              <p className="text-gray-600">Tu reserva está pendiente de confirmación</p>
              <p className="text-sm text-gray-400">
                ID: <span className="font-mono">{bookingResult.id}</span>
              </p>
              <button
                onClick={handleResetBooking}
                className={`text-white text-sm font-medium py-2 px-6 rounded-lg transition-colors ${theme.button}`}
              >
                Reservar otro servicio
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
