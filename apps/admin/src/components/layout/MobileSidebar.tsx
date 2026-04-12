'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, BookOpen, Contact,
  Wrench, Users, BarChart3, Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getMe } from '@/lib/api/auth';
import { getTenantSettings } from '@/lib/api/tenant';
import { canAccess, mergePermissions, type PermissionsConfig } from '@/lib/constants/permissions';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/reservations', label: 'Reservaciones', icon: CalendarDays, key: 'reservations' },
  { href: '/service-log', label: 'Registro del día', icon: BookOpen, key: 'service-log' },
  { href: '/clients', label: 'Clientes', icon: Contact, key: 'clients' },
  { href: '/services', label: 'Servicios', icon: Wrench, key: 'services' },
  { href: '/team', label: 'Equipo', icon: Users, key: 'team' },
  { href: '/reports', label: 'Reportes', icon: BarChart3, key: 'reports' },
  { href: '/settings', label: 'Configuración', icon: Settings, key: 'settings' },
];

interface MobileSidebarProps {
  onNavigate: () => void;
}

export function MobileSidebar({ onNavigate }: MobileSidebarProps) {
  const pathname = usePathname();

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: getTenantSettings,
    staleTime: 5 * 60 * 1000,
  });

  const role = me?.role ?? null;
  const settings = tenantData?.settings as Record<string, unknown> | undefined;
  const customPerms = settings?.permissions as PermissionsConfig | undefined;
  const perms = mergePermissions(customPerms);
  const visibleItems = navItems.filter(item => canAccess(role, item.key, perms));

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900">Turnly</h2>
        <p className="text-sm text-gray-500 mt-1">Panel de administración</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => {
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
