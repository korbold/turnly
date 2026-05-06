'use client';

import { useEffect, useState } from 'react';
import { X, Share } from 'lucide-react';

const DISMISSED_KEY = 'ios-install-banner-dismissed';

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (isIos && !isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 shadow-lg p-4">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <img src="/icons/icon-192.png" alt="Turnly" className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div>
          <p className="font-semibold text-sm text-zinc-900">Instalar Turnly</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Toca{' '}
            <Share className="inline h-3.5 w-3.5 text-blue-500 mx-0.5" />
            {' '}y luego <strong>"Agregar a pantalla de inicio"</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
