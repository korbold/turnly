'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { NotificationBell } from '@/presentation/components/features/notifications/notification-bell';
import { ShareBusinessButton } from '@/presentation/components/layout/share-business-button';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { useMe, useLogout } from '@/presentation/hooks/use-auth';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/reservations': 'Reservaciones',
  '/service-logs': 'Registro Diario',
  '/clients': 'Clientes',
  '/services': 'Servicios',
  '/inventory': 'Inventario',
  '/team': 'Equipo',
  '/reports': 'Reportes',
  '/plan': 'Mi Plan',
  '/settings': 'Configuración',
};

function getPageTitle(pathname: string | null): string {
  if (!pathname) return 'Dashboard';
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) return title;
  }
  return 'Dashboard';
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const logout = useLogout();

  const title = getPageTitle(pathname);

  const userInitials = me?.user?.name
    ? me.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'TU';

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.push('/login'),
    });
  };

  const today = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-6">
      {/* Left: Title + date */}
      <div className="flex items-center gap-3.5">
        <h1
          className="text-[17px] font-bold text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
        >
          {title}
        </h1>
        <span className="hidden h-[18px] w-px bg-[var(--border)] sm:block" />
        <span className="hidden text-[12.5px] text-[var(--fg-secondary)] sm:block">
          {today.charAt(0).toUpperCase() + today.slice(1)}
        </span>
      </div>

      {/* Right: Share + Notifications + Avatar */}
      <div className="flex items-center gap-2">
        <ShareBusinessButton />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-zinc-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-[var(--color-primary-muted)] text-[var(--color-primary-hover)]">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
