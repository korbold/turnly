'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CalendarDays, Home, User } from 'lucide-react';
import { useMe } from '@/presentation/hooks/use-auth';
import { authStorage } from '@/infrastructure/storage/auth-storage';
import { cn } from '@/shared/utils/cn';

const TABS = [
  { href: '/app', label: 'Inicio', Icon: Home },
  { href: '/app/reservas', label: 'Reservas', Icon: CalendarDays },
  { href: '/app/perfil', label: 'Perfil', Icon: User },
] as const;

/**
 * Customer shell. Mirrors the three tabs of the Flutter app (Inicio,
 * Reservas, Perfil) so someone moving between the app and the browser
 * finds the same thing in the same place.
 *
 * Staff are bounced to the panel: the portal shows a person's own
 * bookings, which is meaningless for an account that works at a shop.
 */
export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/app/login';
  const { data: me, isLoading, isError } = useMe({ enabled: !isLogin });

  useEffect(() => {
    if (isLogin) return;

    if (!authStorage.getToken() || isError) {
      router.replace('/app/login');
      return;
    }

    const role = me?.user?.role;
    if (role && role !== 'client') router.replace('/dashboard');
  }, [isLogin, isError, me, router]);

  if (isLogin) return <>{children}</>;

  if (isLoading || !me) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-app)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--brand-500)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-20">
      <main className="mx-auto w-full max-w-2xl px-4 py-5">{children}</main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur"
      >
        <ul className="mx-auto flex w-full max-w-2xl">
          {TABS.map(({ href, label, Icon }) => {
            const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    active ? 'text-[var(--brand-700)]' : 'text-[var(--fg-muted)]',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
