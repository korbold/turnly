'use client';

import { useSyncExternalStore } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/infrastructure/api/client';
import { useMe } from '@/presentation/hooks/use-auth';

interface TenantPlanResponse {
  data: {
    current: { has_custom_page: boolean } | null;
  };
}

const TOUCH_QUERY = '(pointer: coarse)';

function subscribeTouch(onChange: () => void): () => void {
  const mql = window.matchMedia(TOUCH_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getTouchSnapshot(): boolean {
  return window.matchMedia(TOUCH_QUERY).matches;
}

function getServerTouchSnapshot(): boolean {
  return false;
}

export function ShareBusinessButton() {
  const { data: me } = useMe();
  const slug = me?.tenant?.slug ?? null;
  const tenantName = me?.tenant?.name ?? 'mi negocio';

  // Resolved on the client only to avoid a hydration mismatch — SSR does not
  // know whether the device is touch-capable. Subscribed via matchMedia so
  // the icon/label flip if the user changes input mode (e.g. detached pen).
  const touch = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    getServerTouchSnapshot,
  );

  // Hidden until we know the plan; the same query key as the plan and
  // sidebar pages, so the cache is shared and there's no extra request.
  const { data: planData } = useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: async () => {
      const { data } = await api.get<TenantPlanResponse>('/tenant/plan');
      return data.data;
    },
    enabled: !!me?.tenant,
    staleTime: 60_000,
  });

  if (!slug || !planData?.current?.has_custom_page) {
    return null;
  }

  const url =
    typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : '';

  const handleClick = async () => {
    if (!url) return;

    const canNativeShare =
      typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    if (touch && canNativeShare) {
      try {
        await navigator.share({
          title: tenantName,
          text: `Reserva tu cita en ${tenantName}`,
          url,
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // fall through to clipboard on any other error
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  const Icon = touch ? Share2 : Copy;
  const label = touch ? 'Compartir' : 'Copiar link';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={url}
      aria-label={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[12.5px] font-medium text-[var(--fg-default)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)] active:scale-[0.97]"
    >
      <Icon className="h-3.5 w-3.5 text-[var(--fg-secondary)]" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
