'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone } from 'lucide-react';
import { whatsappLink } from '@/shared/utils/whatsapp';
import { WhatsAppIcon } from '@/presentation/components/icons/whatsapp';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GalleryCarousel } from '@/presentation/components/features/public/gallery-carousel';
import { BookingFlow } from '@/presentation/components/features/public/booking-flow';
import { OpenInAppBanner } from '@/presentation/components/features/public/open-in-app-banner';

const FALLBACK_COLOR = '#F2693A';

const INK = '#111827';
const WHITE = '#FFFFFF';

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
}

/**
 * El color lo elige cada negocio y hay celestes, amarillos y verdes entre
 * ellos. Usarlo tal cual daba botones de 2.6:1, cuando PRODUCT.md fija AA
 * (4.5:1) como objetivo. Estas dos funciones oscurecen el color lo mínimo
 * necesario para que pase, y sólo cuando hace falta: un color que ya cumple
 * se usa intacto, así el negocio se sigue reconociendo.
 */
function solidAccent(hex: string): { bg: string; fg: string } {
  const rgb = parseHex(hex);
  if (!rgb) return { bg: FALLBACK_COLOR, fg: WHITE };
  const lum = luminance(rgb);
  if (contrast(lum, luminance(parseHex(WHITE)!)) >= 4.5) return { bg: hex, fg: WHITE };
  if (contrast(lum, luminance(parseHex(INK)!)) >= 4.5) return { bg: hex, fg: INK };
  // Ni blanco ni tinta se leen encima: oscurecer hasta que el blanco entre.
  const target = parseHex('#0B1220')!;
  for (let t = 0.1; t <= 1; t += 0.1) {
    const candidate = mix(rgb, target, t);
    if (contrast(luminance(candidate), luminance(parseHex(WHITE)!)) >= 4.5) {
      return { bg: toHex(candidate), fg: WHITE };
    }
  }
  return { bg: toHex(target), fg: WHITE };
}

/** El mismo color, apto como texto o borde sobre una superficie clara. */
function inkAccent(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return FALLBACK_COLOR;
  const onWhite = luminance(parseHex(WHITE)!);
  if (contrast(luminance(rgb), onWhite) >= 4.5) return hex;
  const target = parseHex('#0B1220')!;
  for (let t = 0.1; t <= 1; t += 0.1) {
    const candidate = mix(rgb, target, t);
    if (contrast(luminance(candidate), onWhite) >= 4.5) return toHex(candidate);
  }
  return toHex(target);
}

export default function PublicTenantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const repo = useRepository('public');
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  const [showBooking, setShowBooking] = useState(false);
  // La barra fija sólo aparece cuando la cabecera —que ya trae el botón— se fue
  // hacia arriba. Si no, dos "Reservar" compitiendo en la misma pantalla.
  const [headerGone, setHeaderGone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['public', 'tenant', slug],
    queryFn: () => repo.getTenantBySlug(slug),
    enabled: !!slug,
  });

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderGone(!entry.isIntersecting),
      { rootMargin: '-8px 0px 0px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)]">
        <Skeleton className="h-44 w-full" />
        <div className="mx-auto max-w-3xl space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-app)] px-4">
        <div className="text-center">
          <h1 className="text-[22px] font-bold text-[var(--fg-strong)]">Negocio no encontrado</h1>
          <p className="mt-1 text-[14px] text-[var(--fg-secondary)]">
            El enlace que seguiste no es válido.
          </p>
        </div>
      </div>
    );
  }

  // `primary` es la identidad (fondos, tintes); `accent` es la identidad
  // ajustada para que se pueda leer encima; `primaryInk` para texto y bordes.
  // Sólo hex: hay tenants con `brand_theme: "blue"` guardado. CSS lo acepta y
  // mis funciones no, así que el tinte salía azul y los botones coral. Un color
  // que no sé medir no lo puedo usar sin romper el contraste.
  const themeHex = tenant.themeColor?.trim() ?? '';
  const primary = /^#?[0-9a-f]{6}$/i.test(themeHex) ? themeHex : FALLBACK_COLOR;
  const { bg: accent, fg: onAccent } = solidAccent(primary);
  const primaryInk = inkAccent(primary);
  const cheapest = tenant.services.reduce<number | null>((min, s) => {
    const price = Number(s.price);
    return Number.isFinite(price) && (min === null || price < min) ? price : min;
  }, null);

  function openBooking(serviceId?: string) {
    setBookingServiceId(serviceId);
    setShowBooking(true);
    requestAnimationFrame(() =>
      document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Barra fija: el nombre para saber dónde estás, y el botón que es a lo
          que vino la página. */}
      <div
        className={`fixed inset-x-0 top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-md transition-transform duration-300 ${
          headerGone ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          {tenant.logoUrl && (
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md border border-[var(--border)] bg-white object-contain p-0.5"
            />
          )}
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--fg-strong)]">
            {tenant.name}
          </span>
          <Button
            size="sm"
            className="h-9 shrink-0 px-4 font-semibold"
            style={{ backgroundColor: accent, color: onAccent }}
            onClick={() => openBooking()}
          >
            Reservar
          </Button>
        </div>
      </div>

      {/* Cabecera. Con portada, la foto manda; sin portada, el color del negocio
          tiñe el fondo detrás de la identidad. Nunca una franja vacía: antes
          eran 256px de degradado sin un solo dato, y el botón de reservar
          quedaba fuera de pantalla. */}
      <header
        className="relative overflow-hidden border-b border-[var(--border)]"
        style={
          tenant.coverUrl
            ? undefined
            : { background: `color-mix(in oklab, ${primary} 14%, white)` }
        }
      >
        {tenant.coverUrl && (
          <>
            <img src={tenant.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/20" />
          </>
        )}

        <div className="relative mx-auto max-w-3xl px-4 pb-6 pt-8 sm:pt-10">
          <div className="flex items-start gap-4">
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                /* object-contain, no cover: los logos son horizontales y el
                   recorte cuadrado se comía media marca. */
                className="h-16 w-auto max-w-[150px] shrink-0 rounded-xl border border-black/5 bg-white object-contain px-3 py-2 shadow-sm sm:h-20 sm:max-w-[200px]"
              />
            ) : (
              <div
                className="grid h-20 w-20 shrink-0 place-items-center rounded-xl text-[30px] font-bold shadow-sm sm:h-24 sm:w-24"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                {tenant.name.charAt(0)}
              </div>
            )}

            <div className="min-w-0 flex-1 pt-1">
              <h1
                className={`text-[26px] font-bold leading-tight sm:text-[32px] ${
                  tenant.coverUrl ? 'text-white' : 'text-[var(--fg-strong)]'
                }`}
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                {tenant.name}
              </h1>
              {tenant.description && (
                <p
                  className={`mt-1 text-[15px] ${
                    tenant.coverUrl ? 'text-white/85' : 'text-[var(--fg-secondary)]'
                  }`}
                >
                  {tenant.description}
                </p>
              )}
            </div>
          </div>

          <div
            className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] ${
              tenant.coverUrl ? 'text-white/85' : 'text-[var(--fg-secondary)]'
            }`}
          >
            {/* La dirección lleva al mapa cuando el negocio cargó el enlace.
                Es el gesto que la persona ya intenta: tocar la dirección para
                que se abra el navegador GPS. Sin enlace, queda como texto. */}
            {/* Con mapa y sin dirección escrita, el enlace igual va: perder el
                dato por no tener con qué etiquetarlo es el mismo error de
                antes, sólo que más chico. */}
            {!tenant.address && tenant.socialLinks.mapsUrl && (
              <a
                href={tenant.socialLinks.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 underline decoration-current/30 underline-offset-2 hover:decoration-current"
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                Cómo llegar
              </a>
            )}
            {tenant.address &&
              (tenant.socialLinks.mapsUrl ? (
                <a
                  href={tenant.socialLinks.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 underline decoration-current/30 underline-offset-2 hover:decoration-current"
                >
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tenant.address}
                </a>
              ) : (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tenant.address}
                </span>
              ))}
            {tenant.phone && (
              <a href={`tel:${tenant.phone}`} className="flex items-center gap-1.5 hover:underline">
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                {tenant.phone}
              </a>
            )}
          </div>

          <Button
            className="mt-5 h-12 w-full text-[15px] font-semibold sm:w-auto sm:px-8"
            style={{ backgroundColor: accent, color: onAccent }}
            onClick={() => openBooking()}
          >
            Reservar una cita
            {cheapest !== null && cheapest > 0 && (
              <span className="ml-1.5 font-normal opacity-80">· desde ${cheapest}</span>
            )}
          </Button>
        </div>
      </header>
      <div ref={sentinel} aria-hidden="true" />

      <div className="mx-auto max-w-3xl px-4 pb-16">
        {/* La galería del negocio, la de verdad. Antes se armaba con las fotos
            de los servicios, así que la misma imagen aparecía arriba enorme y
            otra vez abajo en su tarjeta. Sin fotos cargadas, no hay galería. */}
        {tenant.images.length > 0 && (
          <div className="mt-6">
            <GalleryCarousel images={tenant.images} />
          </div>
        )}

        <section id="reservar" className="mt-8 scroll-mt-16">
          {showBooking ? (
            /* Sin caja alrededor: el paso 1 del asistente ya son tarjetas, y
               una tarjeta dentro de otra no es una jerarquía, es ruido. */
            <div
              /* El asistente hereda el color del negocio: el calendario pinta
                 el día elegido con --color-primary, que es el coral de Turnly,
                 y quedaba una fecha coral en una página azul. */
              style={
                {
                  // `@theme inline` compila bg-primary a var(--brand-500):
                  // pisar --color-primary no hace nada.
                  '--brand-500': accent,
                  '--brand-600': accent,
                } as React.CSSProperties
              }
            >
              <BookingFlow
                slug={slug}
                tenant={tenant}
                initialServiceId={bookingServiceId}
                primaryColor={accent}
              />
            </div>
          ) : (
          <>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Servicios
          </h2>

          <ul className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            {tenant.services.map((svc) => (
              <li key={svc.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                {/* Sin foto no hay marco: un negocio que no subió ninguna
                    mostraba una columna de cuadrados vacíos. */}
                {svc.imageUrl && (
                  <img
                    src={svc.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-[var(--fg-strong)]">{svc.name}</h3>
                  {svc.description && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--fg-secondary)]">
                      {svc.description}
                    </p>
                  )}
                  <p className="mt-1 text-[15px] font-semibold text-[var(--fg-strong)]">
                    ${svc.price}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="h-10 shrink-0 px-4 font-semibold"
                  style={{ borderColor: primary, color: primaryInk }}
                  onClick={() => openBooking(svc.id)}
                >
                  Reservar
                </Button>
              </li>
            ))}
          </ul>
          </>
          )}
        </section>

        {(tenant.socialLinks.instagram || tenant.socialLinks.facebook || tenant.socialLinks.whatsapp) && (
          <footer className="mt-12 flex items-center justify-center gap-6 border-t border-[var(--border)] pt-6">
            {tenant.socialLinks.instagram && (
              <a
                href={`https://instagram.com/${tenant.socialLinks.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-strong)]"
              >
                Instagram
              </a>
            )}
            {tenant.socialLinks.facebook && (
              <a
                href={
                  tenant.socialLinks.facebook.startsWith('http')
                    ? tenant.socialLinks.facebook
                    : `https://facebook.com/${tenant.socialLinks.facebook}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-strong)]"
              >
                Facebook
              </a>
            )}
            {tenant.socialLinks.whatsapp && (
              <a
                /* Quitar los no-dígitos dejaba `wa.me/0991213606`, que no
                   resuelve a ningún contacto: hace falta el internacional. */
                href={whatsappLink(tenant.socialLinks.whatsapp) ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-strong)]"
              >
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </footer>
        )}
      </div>

      <OpenInAppBanner slug={slug} tenantName={tenant.name} />
    </div>
  );
}
