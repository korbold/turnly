'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Smartphone, ExternalLink, Loader2, Globe } from 'lucide-react';
import { authStorage } from '@/infrastructure/storage/auth-storage';
import { useVerifyMagicLink } from '@/presentation/hooks/use-client-portal';
import { apiErrorMessage } from '@/shared/utils/api-error';

const ANDROID_PACKAGE_DEV = 'com.turnly.customer.dev';
const ANDROID_PACKAGE_PROD = 'com.turnly.customer';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.turnly.customer';

function detectPlatform(ua: string): 'android' | 'ios' | 'desktop' {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}

export default function MagicLinkLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verify = useVerifyMagicLink();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPlatform(detectPlatform(window.navigator.userAgent));
  }, []);

  function tryOpenApp() {
    if (typeof window === 'undefined' || platform === null) return;

    if (platform === 'android') {
      const host = window.location.host;
      const path = window.location.pathname + window.location.search;
      const pkg = host.startsWith('dev.') ? ANDROID_PACKAGE_DEV : ANDROID_PACKAGE_PROD;
      // No store fallback: the app is not published yet, so a failed
      // open must leave the customer on this page, where the browser
      // route is waiting — not on an empty store listing.
      window.location.href = `intent://${host}${path}#Intent;scheme=https;package=${pkg};end`;
      return;
    }

    if (platform === 'ios') {
      window.location.href = window.location.href;
    }
  }

  /**
   * Consumes the link right here and drops the customer into the web
   * portal. This is the path that works with no app installed — the
   * whole reason the portal exists while Play review is pending.
   */
  function continueInBrowser() {
    setError(null);
    verify.mutate(token, {
      onSuccess: (session) => {
        authStorage.setToken(session.token);
        router.replace('/app');
      },
      onError: (e) =>
        setError(apiErrorMessage(e, 'El link no es válido o ya venció. Pide uno nuevo.')),
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-white p-7 text-center shadow-[0_1px_2px_0_rgba(15,18,26,0.05)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)]">
          <Smartphone className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-[20px] font-bold tracking-[-0.01em] text-[var(--ink-900)]">
          Entra a Turnly
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-600)]">
          Continúa aquí mismo en el navegador, o ábrelo en la app si ya la tienes instalada.
        </p>

        <button
          type="button"
          onClick={continueInBrowser}
          disabled={verify.isPending}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97] disabled:opacity-70"
        >
          {verify.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Globe className="h-4 w-4" aria-hidden="true" />
          )}
          {verify.isPending ? 'Entrando…' : 'Continuar en el navegador'}
        </button>

        {platform !== 'desktop' && (
          <button
            type="button"
            onClick={tryOpenApp}
            className="mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] text-[14px] font-semibold text-[var(--ink-900)] transition-colors hover:bg-[var(--niebla-clara,#F4F5F7)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir en la app
          </button>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[12.5px] leading-snug text-[var(--danger-700)]">
            {error}{' '}
            <Link href="/app/login" className="font-semibold underline">
              Pedir otro link
            </Link>
          </p>
        )}

        {platform === 'android' && !error && (
          <p className="mt-4 text-[12px] leading-snug text-[var(--ink-500)]">
            ¿Aún no tienes la app?{' '}
            <Link
              href={PLAY_STORE_URL}
              className="font-semibold text-[var(--brand-700)] hover:text-[var(--brand-600)]"
            >
              Verla en Play Store
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
