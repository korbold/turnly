'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '@/infrastructure/api/client';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Scissors,
  UserPlus,
  BarChart3,
  CreditCard,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Separator } from '@/presentation/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/presentation/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import { useMe, useLogout } from '@/presentation/hooks/use-auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Reservaciones', href: '/reservations', icon: Calendar },
  { label: 'Registro Diario', href: '/service-logs', icon: ClipboardList },
  { label: 'Clientes', href: '/clients', icon: Users },
  { label: 'Servicios', href: '/services', icon: Scissors },
  { label: 'Equipo', href: '/team', icon: UserPlus },
  { label: 'Reportes', href: '/reports', icon: BarChart3 },
  { label: 'Mi Plan', href: '/plan', icon: CreditCard },
];

const bottomNavItems: NavItem[] = [
  { label: 'Configuración', href: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

interface TenantPlanData {
  current: { id: string; name: string; price: number } | null;
  is_trial: boolean;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const logout = useLogout();
  const { data: planData } = useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TenantPlanData }>('/tenant/plan');
      return data.data;
    },
    enabled: !!me?.tenant,
    staleTime: 60_000,
  });

  const isActive = (href: string) => pathname?.startsWith(href);

  const userInitials = me?.user?.name
    ? me.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'TU';

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex h-screen flex-col border-r border-zinc-200 bg-white"
      >
        {/* Logo + Tenant */}
        <div className="border-b border-zinc-200">
          <div className="flex h-16 items-center gap-3 px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              T
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  Turnly
                </p>
                {me?.tenant?.name && (
                  <p className="text-xs text-zinc-500 truncate">
                    {me.tenant.name}
                  </p>
                )}
              </motion.div>
            )}
          </div>
          {!collapsed && planData?.current && (
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between gap-2 rounded-md bg-indigo-50 px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-indigo-500">
                    {planData.is_trial ? 'Prueba' : 'Plan'}
                  </p>
                  <p className="truncate text-xs font-semibold text-indigo-900">
                    {planData.current.name}
                  </p>
                </div>
                <Link
                  href="/plan"
                  className="shrink-0 rounded bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Actualizar
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={!!isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <Separator />

        {/* Bottom nav */}
        <div className="px-2 py-3 space-y-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={!!isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Profile */}
          <div
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600',
              collapsed && 'justify-center px-0'
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="truncate flex-1">{me?.user?.name ?? 'Usuario'}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => logout.mutate()}
                      className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Cerrar sesión</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* Toggle button */}
        <div className="border-t border-zinc-200 px-2 py-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-lg py-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-50 border-l-2 border-indigo-600 text-indigo-600'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        collapsed && 'justify-center px-0'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-medium text-white">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
