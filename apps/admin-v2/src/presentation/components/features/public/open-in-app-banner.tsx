'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

const ANDROID_PACKAGE = 'com.turnly.customer';
const DISMISS_KEY = 'turnly-open-in-app-dismissed';

interface Props {
  slug: string;
  tenantName: string;
}

function isAndroid(ua: string): boolean {
  return /android/i.test(ua) && !/wv\)/i.test(ua); // exclude in-app webviews
}

export function OpenInAppBanner({ slug, tenantName }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent;
    if (!isAndroid(ua)) return;
    if (window.sessionStorage.getItem(DISMISS_KEY) === '1') return;
    setShow(true);
  }, []);

  if (!show) return null;

  function handleOpen() {
    const host = window.location.host;
    const intentUrl = `intent://${host}/${slug}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    )};end`;
    window.location.href = intentUrl;
  }

  function handleDismiss() {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Abrir en la app Turnly"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-soft)] bg-white/95 px-4 py-3 backdrop-blur-md sm:hidden"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-[var(--ink-900)]">
            {tenantName}
          </p>
          <p className="truncate text-[12px] text-[var(--ink-500)]">
            Reserva más rápido en la app Turnly.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--brand-500)] px-3 text-[12.5px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
        >
          Abrir
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors duration-150 hover:bg-[var(--niebla-media)] hover:text-[var(--ink-900)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
