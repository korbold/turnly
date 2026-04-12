'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, BookOpen, Contact,
  Wrench, Users, BarChart3, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reservations', label: 'Reservaciones', icon: CalendarDays },
  { href: '/service-log', label: 'Registro del día', icon: BookOpen },
  { href: '/clients', label: 'Clientes', icon: Contact },
  { href: '/services', label: 'Servicios', icon: Wrench },
  { href: '/team', label: 'Equipo', icon: Users },
  { href: '/reports', label: 'Reportes', icon: BarChart3 },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

interface MobileSidebarProps {
  onNavigate: () => void;
}

export function MobileSidebar({ onNavigate }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900">Turnly</h2>
        <p className="text-sm text-gray-500 mt-1">Panel de administración</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
