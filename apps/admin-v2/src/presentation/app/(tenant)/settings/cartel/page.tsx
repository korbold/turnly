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

/** Mezcla hacia blanco, en hex: `color-mix()` depende del motor que renderice
    el PDF, y un fondo que no se calcula deja la pastilla transparente. */
function tintOf(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const mixed = [0, 2, 4].map((i) => {
    const v = parseInt(m[1].slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * (1 - amount));
  });
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * El mismo color, oscurecido lo necesario para leerse SOBRE EL FONDO QUE VA A
 * TENER. Un celeste de marca funciona como banda y desaparece como texto; y
 * calcularlo contra blanco cuando el fondo real es un tinte deja el resultado
 * corto —4.04:1 medido, con 4.5 como objetivo—. En papel, además, no hay
 * brillo de pantalla que lo salve.
 */
function inkOn(hex: string, background = '#FFFFFF'): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#0E121A';
  const rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number];
  const lum = (c: [number, number, number]) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const bg = /^#?([0-9a-f]{6})$/i.exec(background);
  const bgRgb = (bg ? [0, 2, 4].map((i) => parseInt(bg[1].slice(i, i + 2), 16)) : [255, 255, 255]) as
    [number, number, number];
  const contrast = (l: number) => {
    const lb = lum(bgRgb);
    return (Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05);
  };
  const target: [number, number, number] = [11, 18, 32];
  let cur = rgb;
  for (let i = 0; i <= 10; i++) {
    if (contrast(lum(cur)) >= 4.5) break;
    cur = cur.map((v, j) => v + (target[j] - v) * 0.1) as [number, number, number];
  }
  return `#${cur.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
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

  const brand = brandColor(settings.themeColor);
  const brandTint = tintOf(brand, 0.12);
  const brandInk = inkOn(brand);
  // La URL vive dentro de la pastilla, no sobre el papel: su tinta se mide
  // contra el tinte, que es el fondo que de verdad tiene debajo.
  const brandInkOnTint = inkOn(brand, brandTint);

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
        <div
          className="relative flex min-h-[297mm] flex-col items-center px-[16mm] pb-[16mm] pt-[22mm] text-center"
        >
          {/* Una banda fina arriba, no un fondo a sangre: el dueño imprime esto
              en la inyección de tinta del local, y una hoja llena de color se
              come el cartucho y sale con bandas. */}
          <div
            className="absolute inset-x-0 top-0 h-[7mm]"
            style={{ backgroundColor: brand }}
          />

          <header className="flex w-full flex-col items-center">
            {settings.logoUrl ? (
              /* Sin repetir el nombre debajo: el logo ya lo dice, y en grande.
                 Escribirlo otra vez le robaba tamaño a lo que sí importa. */
              <img
                src={settings.logoUrl}
                alt={settings.name}
                className="max-h-[42mm] max-w-[140mm] object-contain"
              />
            ) : (
              <h1
                className="text-[42px] font-bold leading-tight tracking-[-0.02em]"
                style={{ color: brandInk }}
              >
                {settings.name}
              </h1>
            )}
          </header>

          {/* El bloque que manda. Va centrado en el espacio que sobra, así la
              hoja no queda con dos huecos y un contenido flotando arriba. */}
          <div className="flex flex-1 flex-col items-center justify-center gap-[9mm] py-[8mm]">
            <div>
              <p className="text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0E121A]">
                Escanea y reserva
                <br />
                tu cita
              </p>
              <p className="mt-[4mm] text-[17px] text-[#4B5462]">
                Apunta la cámara de tu teléfono al código.
              </p>
            </div>

            {/* El QR siempre negro sobre blanco y con su marco: teñirlo con el
                color de la marca es la forma más rápida de que un lector barato
                deje de leerlo. */}
            {qrSvg ? (
              <div
                className="rounded-[4mm] border border-[#E4E7EC] bg-white p-[5mm]"
              >
                <div
                  className="h-[104mm] w-[104mm] [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              </div>
            ) : (
              <div className="grid h-[104mm] w-[104mm] place-items-center rounded-[4mm] bg-[#F4F5F7] text-[13px] text-[#6B7280]">
                Generando el código…
              </div>
            )}
          </div>

          <footer className="w-full">
            {/* La URL en texto, dentro de una pastilla del color del negocio:
                quien no puede escanear igual la escribe, y el papel sirve
                aunque la cámara falle. */}
            <p
              className="inline-block rounded-full px-[8mm] py-[3mm] text-[19px] font-semibold"
              style={{ backgroundColor: brandTint, color: brandInkOnTint }}
            >
              {bookingUrl?.replace(/^https?:\/\//, '')}
            </p>
            {(settings.address || settings.phone) && (
              <p className="mt-[5mm] text-[14px] text-[#6B7280]">
                {[settings.address, settings.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </footer>
        </div>
      </div>
    </>
  );
}
