'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useMe } from '@/presentation/hooks/use-auth';
import { authStorage } from '@/infrastructure/storage/auth-storage';

/**
 * Header actions for the marketing pages.
 *
 * Those pages sell Turnly to businesses, so they offered "Iniciar sesión"
 * and "Empezar gratis" to everyone — including a customer who had just
 * signed in and was browsing for somewhere to book. Worse, that login
 * link leads to the staff panel, which asks for a password no customer
 * ever set.
 *
 * Rendered on the client because the session lives in localStorage; it
 * falls back to the signed-out links until it knows otherwise, so the
 * markup never flashes the wrong door for long.
 */
export function SessionNav() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!authStorage.getToken());
  }, []);

  const { data: me } = useMe({ enabled: hasToken });
  const role = me?.user?.role;

  // A customer belongs to no business, so /auth/me answers role: null.
  // Anyone who is not staff goes to the portal — keying off role ===
  // 'client' would have sent every real customer back to the login door.
  const isStaff = !!role && ['owner', 'tenant_admin', 'cashier', 'washer'].includes(role);

  if (me && isStaff) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center rounded-lg bg-[var(--brand-500)] px-3.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
      >
        Ir al panel
      </Link>
    );
  }

  if (me) {
    return (
      <Link
        href="/app"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand-500)] px-3.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        Mis reservas
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="text-[13px] text-[var(--ink-600)] transition-colors duration-150 hover:text-[var(--ink-900)]"
      >
        Iniciar sesión
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center rounded-lg bg-[var(--brand-500)] px-3.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
      >
        Empezar gratis
      </Link>
    </>
  );
}
