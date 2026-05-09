'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Smartphone, ExternalLink, AlertCircle } from 'lucide-react';

const ANDROID_PACKAGE_DEV = 'com.turnly.customer.dev';
const ANDROID_PACKAGE_PROD = 'com.turnly.customer';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.turnly.customer';
const APP_STORE_URL = 'https://apps.apple.com/app/turnly';

function detectPlatform(ua: string): 'android' | 'ios' | 'desktop' {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}

export default function EmailLinkLandingPage() {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = detectPlatform(window.navigator.userAgent);
    setPlatform(p);
  }, []);

  function tryOpenApp() {
    if (typeof window === 'undefined' || platform === null) return;
    setTried(true);

    if (platform === 'android') {
      const host = window.location.host;
      const path = window.location.pathname + window.location.search;
      const isDev = host.startsWith('dev.');
      const pkg = isDev ? ANDROID_PACKAGE_DEV : ANDROID_PACKAGE_PROD;
      const intentUrl = `intent://${host}${path}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(
        PLAY_STORE_URL,
      )};end`;
      window.location.href = intentUrl;
      return;
    }

    if (platform === 'ios') {
      // Re-navigating to the same URL from a user gesture lets iOS try
      // the Universal Link route. If the app is installed, it opens.
      window.location.href = window.location.href;
    }
  }

  useEffect(() => {
    if (platform === 'ios' || platform === 'android') {
      // Auto-try once on mobile load — most of the time UL/App Links
      // already fired before this page even rendered. This is a fallback.
      const id = setTimeout(tryOpenApp, 400);
      return () => clearTimeout(id);
    }
  }, [platform]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-white p-7 text-center shadow-[0_1px_2px_0_rgba(15,18,26,0.05)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)]">
          <Smartphone className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-[20px] font-bold tracking-[-0.01em] text-[var(--ink-900)]">
          Abre Turnly
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-600)]">
          Tu link de acceso te lleva a la app Turnly. Si no se abrió sola, pulsa el botón.
        </p>

        {platform === 'desktop' ? (
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)] px-4 py-3 text-left">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]"
              aria-hidden="true"
            />
            <p className="text-[12.5px] leading-snug text-[var(--ink-600)]">
              Este link sólo funciona en tu celular. Abre el correo desde el iPhone o Android
              donde tienes la app instalada.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={tryOpenApp}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir en la app
          </button>
        )}

        {tried && platform !== 'desktop' && (
          <p className="mt-4 text-[12px] leading-snug text-[var(--ink-500)]">
            ¿No se abrió? Quizás aún no tienes la app.
            <br />
            <Link
              href={platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL}
              className="font-semibold text-[var(--brand-700)] hover:text-[var(--brand-600)]"
            >
              Descargarla aquí
            </Link>
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-[11.5px] text-[var(--ink-500)]">
        ¿Querías el panel admin? <Link href="/login" className="font-medium text-[var(--brand-700)]">Inicia sesión aquí</Link>
      </p>
    </div>
  );
}
