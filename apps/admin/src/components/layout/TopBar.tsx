'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, LogOut, User, Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logout } from '@/lib/api/auth';
import { MobileSidebar } from './MobileSidebar';

const PATH_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/reservations': 'Reservaciones',
  '/service-log': 'Registro del día',
  '/clients': 'Clientes',
  '/services': 'Servicios',
  '/team': 'Equipo',
  '/reports': 'Reportes',
  '/settings': 'Configuración',
};

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const basePath = '/' + (pathname.split('/')[1] ?? '');
  const pageTitle = PATH_TITLES[basePath] ?? '';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#DFE5EE] bg-white">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="lg:hidden" />}
          >
            <Menu className="h-5 w-5 text-[#343C6A]" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <MobileSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Mobile: page title centered / Desktop: spacer */}
        <div className="flex-1 lg:hidden flex justify-center">
          {pageTitle && (
            <span className="font-semibold text-[#343C6A]">{pageTitle}</span>
          )}
        </div>
        <div className="hidden lg:block flex-1" />

        {/* Notification bell */}
        <Button variant="ghost" size="icon" className="text-[#718EBF] hover:text-[#343C6A]">
          <Bell className="h-5 w-5" />
        </Button>

        {/* Settings icon */}
        <Button variant="ghost" size="icon" className="text-[#718EBF] hover:text-[#343C6A]">
          <Settings className="h-5 w-5" />
        </Button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" />
            }
          >
            <Avatar className="h-9 w-9 bg-[#396AFF]">
              <AvatarFallback className="bg-[#396AFF] text-white text-sm font-medium">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
