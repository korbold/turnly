'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GalleryCarousel } from '@/presentation/components/features/public/gallery-carousel';
import { BookingFlow } from '@/presentation/components/features/public/booking-flow';
import type { PublicTenant } from '@/domain/repositories/public.repository';

export default function PublicTenantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const repo = useRepository('public');
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  const [showBooking, setShowBooking] = useState(false);

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['public', 'tenant', slug],
    queryFn: () => repo.getTenantBySlug(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Skeleton className="h-64 w-full" />
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Negocio no encontrado</h1>
          <p className="mt-1 text-muted-foreground">El enlace que seguiste no es valido.</p>
        </div>
      </div>
    );
  }

  const primaryColor = tenant.themeColor ?? '#F2693A';

  function handleBookService(serviceId: string) {
    setBookingServiceId(serviceId);
    setShowBooking(true);
    // Scroll to booking section
    document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-zinc-50" style={{ '--tenant-primary': primaryColor } as React.CSSProperties}>
      {/* Cover */}
      {tenant.coverUrl ? (
        <div className="h-48 sm:h-64">
          <img src={tenant.coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-48 sm:h-64" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)` }} />
      )}

      <div className="mx-auto max-w-4xl px-4 pb-12">
        {/* Business info */}
        <div className="-mt-12 flex items-end gap-4">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-24 w-24 rounded-xl border-4 border-white object-cover shadow-lg" />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-xl border-4 border-white text-3xl font-bold text-white shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              {tenant.name.charAt(0)}
            </div>
          )}
          <div className="pb-1">
            <h1 className="text-2xl font-bold text-zinc-900">{tenant.name}</h1>
            {tenant.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{tenant.description}</p>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {tenant.address && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {tenant.address}
            </span>
          )}
          {tenant.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {tenant.phone}
            </span>
          )}
        </div>

        {/* Gallery */}
        {tenant.services.some((s) => s.imageUrl) && (
          <div className="mt-6">
            <GalleryCarousel
              images={tenant.services.filter((s) => s.imageUrl).map((s) => s.imageUrl!)}
            />
          </div>
        )}

        {/* Services */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Servicios</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tenant.services.map((svc) => (
              <Card key={svc.id} className="overflow-hidden">
                <CardContent className="p-4">
                  {svc.imageUrl && (
                    <img src={svc.imageUrl} alt={svc.name} className="mb-3 h-32 w-full rounded-md object-cover" />
                  )}
                  <h3 className="font-medium">{svc.name}</h3>
                  {svc.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{svc.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-semibold" style={{ color: primaryColor }}>
                      ${svc.price}
                    </span>
                    <Button size="sm" style={{ backgroundColor: primaryColor }} onClick={() => handleBookService(svc.id)}>
                      Reservar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Booking flow */}
        <div id="booking-section" className="mt-8">
          {showBooking && (
            <Card>
              <CardContent className="p-6">
                <BookingFlow
                  slug={slug}
                  tenant={tenant}
                  initialServiceId={bookingServiceId}
                  primaryColor={primaryColor}
                />
              </CardContent>
            </Card>
          )}
          {!showBooking && (
            <Button
              className="w-full text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={() => setShowBooking(true)}
            >
              Reservar Ahora
            </Button>
          )}
        </div>

        {/* Social links footer */}
        {(tenant.socialLinks.instagram || tenant.socialLinks.facebook || tenant.socialLinks.whatsapp) && (
          <div className="mt-12 flex items-center justify-center gap-4 border-t pt-6">
            {tenant.socialLinks.instagram && (
              <a
                href={`https://instagram.com/${tenant.socialLinks.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="text-sm">IG</span>
                Instagram
              </a>
            )}
            {tenant.socialLinks.facebook && (
              <a
                href={tenant.socialLinks.facebook.startsWith('http') ? tenant.socialLinks.facebook : `https://facebook.com/${tenant.socialLinks.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="text-sm">FB</span>
                Facebook
              </a>
            )}
            {tenant.socialLinks.whatsapp && (
              <a
                href={`https://wa.me/${tenant.socialLinks.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
