'use client';

import { useEffect, useState } from 'react';
import { X, Share, Download } from 'lucide-react';

const DISMISSED_KEY = 'pwa-install-banner-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function IosInstallBanner() {
  const [mode, setMode] = useState<'ios' | 'chrome' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setMode('ios');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode('chrome');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setMode(null);
  }

  async function installChrome() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(DISMISSED_KEY, '1');
    setMode(null);
  }

  if (!mode) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 shadow-lg p-4">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <img src="/icons/icon-192.png" alt="Turnly" className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-zinc-900">Instalar Turnly</p>
          {mode === 'ios' ? (
            <p className="text-xs text-zinc-500 mt-0.5">
              Toca{' '}
              <Share className="inline h-3.5 w-3.5 text-blue-500 mx-0.5" />
              {' '}y luego <strong>"Agregar a pantalla de inicio"</strong>
            </p>
          ) : (
            <p className="text-xs text-zinc-500 mt-0.5">Acceso rápido desde tu dispositivo</p>
          )}
        </div>
        {mode === 'chrome' && (
          <button
            onClick={installChrome}
            className="flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar
          </button>
        )}
      </div>
    </div>
  );
}
