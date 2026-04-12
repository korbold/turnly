'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, BookOpen, Contact,
  Wrench, Users, BarChart3, Settings, Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getMe } from '@/lib/api/auth';
import { getTenantSettings } from '@/lib/api/tenant';
import { canAccess, mergePermissions, type PermissionsConfig } from '@/lib/constants/permissions';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/reservations', label: 'Reservaciones', icon: CalendarDays, key: 'reservations' },
  { href: '/service-log', label: 'Registro del día', icon: BookOpen, key: 'service-log' },
  { href: '/clients', label: 'Clientes', icon: Contact, key: 'clients' },
  { href: '/services', label: 'Servicios', icon: Wrench, key: 'services' },
  { href: '/team', label: 'Equipo', icon: Users, key: 'team' },
  { href: '/reports', label: 'Reportes', icon: BarChart3, key: 'reports' },
];

const settingsItems = [
  { href: '/settings', label: 'Configuración', icon: Settings, key: 'settings' },
];

export function Sidebar() {
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

  const visibleMenuItems = menuItems.filter(item => canAccess(role, item.key, perms));
  const visibleSettingsItems = settingsItems.filter(item => canAccess(role, item.key, perms));

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 h-screen sticky top-0 bg-white border-r border-[#DFE5EE]">
      {/* Logo */}
      <div className="px-6 py-5">
        <h2 className="text-xl font-bold text-[#343C6A] tracking-tight">Turnly</h2>
      </div>

      {/* Search */}
      <div className="mx-4 my-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#718EBF]" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full h-9 bg-[#EDF1F7] border-none rounded-lg pl-9 pr-3 text-sm text-[#343C6A] placeholder:text-[#718EBF] focus:outline-none focus:ring-1 focus:ring-[#396AFF]"
          />
        </div>
      </div>

      {/* Menu section */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-6 mt-6 mb-2 text-[10px] uppercase tracking-widest text-[#718EBF] font-medium">
          Menu
        </p>
        <nav className="space-y-0.5">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center mx-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-[#E7EDFF] text-[#1814F3] font-medium border-l-[3px] border-[#1814F3]'
                    : 'text-[#B1B1B1] hover:bg-[#F5F7FA] hover:text-[#343C6A]'
                )}
              >
                <Icon className="h-5 w-5 mr-3 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Settings section */}
      {visibleSettingsItems.length > 0 && (
        <div className="mt-auto border-t border-[#DFE5EE] pt-4 pb-6">
          <p className="px-6 mb-2 text-[10px] uppercase tracking-widest text-[#718EBF] font-medium">
            Configuración
          </p>
          <nav className="space-y-0.5">
            {visibleSettingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center mx-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-[#E7EDFF] text-[#1814F3] font-medium border-l-[3px] border-[#1814F3]'
                      : 'text-[#B1B1B1] hover:bg-[#F5F7FA] hover:text-[#343C6A]'
                  )}
                >
                  <Icon className="h-5 w-5 mr-3 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}
