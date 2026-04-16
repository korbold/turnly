'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
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
  '/team': 'Equipo',
  '/reports': 'Reportes',
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

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:px-6">
      {/* Left: Breadcrumb / Page title */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
      </div>

      {/* Center: Search button */}
      <button
        className="hidden md:flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-100 transition-colors"
        onClick={() => {
          /* Command palette placeholder */
        }}
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Buscar...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 text-[10px] font-medium text-zinc-400">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>

      {/* Right: Notifications + Avatar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="relative text-zinc-500 hover:text-zinc-700"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificaciones</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-zinc-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
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
