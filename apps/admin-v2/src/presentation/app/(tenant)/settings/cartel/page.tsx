'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useSettings } from '@/presentation/hooks/use-settings';

/**
 * El panel y la página pública se sirven del mismo dominio, así que el origen
 * del navegador ya es la respuesta: en producción imprime goturnly.com y en
 * staging, staging.goturnly.com. Una variable de entorno de más es una que se
 * queda vieja.
 */
function publicHost(): string {
  if (typeof window === 'undefined') return 'https://goturnly.com';
  return window.location.origin;
}

const FALLBACK_COLOR = '#F2693A';

/** Sólo hex: hay tenants con `brand_theme: "blue"`, que CSS acepta y aquí
    imprimiría un azul puro que no es el de nadie. */
function brandColor(value: string | null | undefined): string {
  const hex = value?.trim() ?? '';
  return /^#?[0-9a-f]{6}$/i.test(hex) ? hex : FALLBACK_COLOR;
}

/**
 * El cartel que el negocio imprime y pega en el mostrador: su logo, un QR
 * grande y la promesa de que escanear alcanza para reservar.
 *
 * Sale por el diálogo de impresión, no por un motor de PDF: es el mismo camino
 * que ya usa Reportes, el navegador ofrece "Guardar como PDF", y evita cargar
 * cien kilobytes de librería para dibujar una hoja al año. El `@page` de
 * `globals.css` es carta, así que esta ruta declara el suyo.
 */
export default function PosterPage() {
  const router = useRouter();
  const { data: settings, isLoading } = useSettings();
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  const bookingUrl = useMemo(
    () => (settings?.slug ? `${publicHost()}/${settings.slug}` : null),
    [settings?.slug],
  );

  useEffect(() => {
    if (!bookingUrl) return;
    // SVG y no PNG: el cartel se imprime a 9 cm y un mapa de bits se ve
    // dentado justo donde la cámara tiene que leer.
    QRCode.toString(bookingUrl, {
      type: 'svg',
      // 'Q' aguanta hasta un 25% del código tapado o gastado: es papel, en un
      // mostrador, con dedos y polvo encima.
      errorCorrectionLevel: 'Q',
      // La zona de silencio va DENTRO del SVG. El blanco de la hoja alcanzaría
      // hoy, pero basta que alguien lo recorte o lo pegue sobre algo oscuro
      // para que ningún lector lo encuentre.
      margin: 4,
      color: { dark: '#0E121A', light: '#FFFFFF' },
    })
      .then(setQrSvg)
      .catch(() => setQrSvg(null));
  }, [bookingUrl]);

  if (isLoading || !settings) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      {/* A4 sólo para esta hoja. El @page global es carta y lo dejaría
          descentrado, con el QR mordido en el borde. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }

          html, body { background: #ffffff !important; height: auto !important; }


          .poster-sheet {
            width: 210mm !important;
            max-width: none !important;
            min-height: 297mm !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Barra de la app: existe en pantalla, desaparece al imprimir. */}
      <div className="print:hidden">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-strong)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver
          </button>
          <Button onClick={() => window.print()} disabled={!qrSvg}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Imprimir
          </Button>
        </div>
        <p className="mb-4 text-[13px] text-[var(--fg-secondary)]">
          Al imprimir, elige <strong>A4</strong> y, si quieres el archivo,
          «Guardar como PDF» en el destino.
        </p>
      </div>

      {/* La hoja. En pantalla se ve encogida dentro de su marco; al imprimir
          ocupa la página entera. */}
      <div className="poster-sheet mx-auto w-full max-w-[210mm] rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex min-h-[297mm] flex-col items-center justify-between px-[18mm] py-[22mm] text-center">
          <header className="flex w-full flex-col items-center gap-5">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt=""
                className="max-h-[38mm] max-w-[110mm] object-contain"
              />
            ) : (
              <div
                className="grid h-[30mm] w-[30mm] place-items-center rounded-2xl text-[42px] font-bold text-white"
                style={{ backgroundColor: brandColor(settings.themeColor) }}
              >
                {settings.name.charAt(0)}
              </div>
            )}
            <h1
              className="text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#0E121A]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {settings.name}
            </h1>
          </header>

          <div className="flex flex-col items-center gap-7">
            {qrSvg ? (
              <div
                className="h-[90mm] w-[90mm] [&>svg]:h-full [&>svg]:w-full"
                // El SVG lo genera qrcode a partir de la URL; no hay entrada
                // de usuario en ese string más que el slug del propio negocio.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="grid h-[90mm] w-[90mm] place-items-center rounded-lg bg-[#F4F5F7] text-[13px] text-[#6B7280]">
                Generando el código…
              </div>
            )}

            <div>
              <p className="text-[30px] font-bold leading-tight tracking-[-0.01em] text-[#0E121A]">
                Escanea y reserva tu cita
              </p>
              <p className="mt-2 text-[15px] text-[#4B5462]">
                Apunta la cámara de tu teléfono al código.
              </p>
            </div>
          </div>

          <footer className="w-full">
            {/* La URL en texto: quien no puede escanear igual puede escribirla,
                y el papel sirve aunque la cámara falle. */}
            <p className="text-[17px] font-semibold text-[#0E121A]">
              {bookingUrl?.replace(/^https?:\/\//, '')}
            </p>
            {(settings.address || settings.phone) && (
              <p className="mt-2 text-[13px] text-[#6B7280]">
                {[settings.address, settings.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </footer>
        </div>
      </div>
    </>
  );
}
