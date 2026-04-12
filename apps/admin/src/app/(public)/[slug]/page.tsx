'use client';

import { use, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getPublicTenant,
  type PublicService,
  type PublicAvailability,
} from '@/lib/api/public';
import { MapPin, Phone, Instagram, Facebook, MessageCircle } from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BusinessPage({ params }: PageProps) {
  const { slug } = use(params);
  const bookingRef = useRef<HTMLDivElement>(null);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);

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
    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Build schedule map: day_of_week -> list of time ranges
  const scheduleMap = new Map<number, PublicAvailability[]>();
  for (const slot of availability) {
    const existing = scheduleMap.get(slot.day_of_week) ?? [];
    existing.push(slot);
    scheduleMap.set(slot.day_of_week, existing);
  }

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
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {tenant.social_links.facebook && (
              <a
                href={tenant.social_links.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Facebook className="h-5 w-5" />
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
      {/* E) Booking section (placeholder - will be expanded) */}
      {/* ---------------------------------------------------------------- */}
      <div ref={bookingRef}>
        {selectedService && (
          <section className="mt-10 mb-10 px-4 md:px-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reservar</h2>
              <p className="text-gray-600">
                {selectedService.name} &mdash;{' '}
                <span className="font-semibold">${Number(selectedService.price).toFixed(2)}</span>
              </p>
              {/* Booking flow steps will go here */}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
