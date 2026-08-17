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
  Package,
  UserPlus,
  BarChart3,
  CreditCard,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  LogOut,
  Receipt,
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
import { usePermissions } from '@/presentation/hooks/use-permissions';

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
  { label: 'Inventario', href: '/inventory', icon: Package },
  { label: 'Equipo', href: '/team', icon: UserPlus },
  { label: 'Reportes', href: '/reports', icon: BarChart3 },
  { label: 'Facturas', href: '/facturas', icon: Receipt },
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
  current: {
    id: string;
    name: string;
    price: number;
    max_reservations_per_month: number | null;
  } | null;
  is_trial: boolean;
  usage: {
    services: number;
    reservations_this_month: number;
    employees: number;
  };
  available?: { id: string; price: number }[];
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const logout = useLogout();
  const { canAccess } = usePermissions();
  const { data: planData } = useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TenantPlanData }>('/tenant/plan');
      return data.data;
    },
    enabled: !!me?.tenant,
    staleTime: 60_000,
  });

  // Nothing left to sell on the top tier, so the card stops nudging and just
  // reports. Compared by price rather than by slug, so adding a plan above
  // Premium brings the upgrade button back on its own.
  const topPrice = Math.max(0, ...(planData?.available ?? []).map((p) => p.price));
  const onTopPlan =
    !planData?.is_trial &&
    !!planData?.current &&
    (planData.available?.length ?? 0) > 0 &&
    planData.current.price >= topPrice;

  const reservationsUsed = planData?.usage.reservations_this_month ?? 0;
  const reservationsLabel =
    planData?.current?.max_reservations_per_month == null
      ? `${reservationsUsed} ${reservationsUsed === 1 ? 'reserva' : 'reservas'} este mes`
      : `${reservationsUsed} / ${planData.current.max_reservations_per_month} reservas este mes`;

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
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
            <img
              src="/turnly-mark.svg"
              alt="Turnly"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-lg"
            />
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <p
                  className="truncate text-[15px] font-bold text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-display)', fontStretch: '90%', letterSpacing: '-0.01em' }}
                >
                  Turnly
                </p>
                {me?.tenant?.name && (
                  <p className="truncate text-[11.5px] text-[var(--fg-secondary)]">
                    {me.tenant.name}
                  </p>
                )}
              </motion.div>
            )}
          </div>
          {!collapsed && planData?.current && (
            <div className="px-4 pb-3">
              {onTopPlan ? (
                // Whole card is the link: no call to action, but the plan and
                // its billing are still one click away.
                <Link
                  href="/plan"
                  className="flex items-center gap-2 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] px-2.5 py-2 transition-colors hover:bg-[var(--brand-100)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--brand-600)]">
                      Plan {planData.current.name}
                    </p>
                    <p className="truncate text-[11.5px] font-semibold text-[var(--brand-700)]">
                      {reservationsLabel}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--brand-600)]"
                    aria-hidden="true"
                  />
                </Link>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--brand-600)]">
                      {planData.is_trial ? 'Prueba' : `Plan ${planData.current.name}`}
                    </p>
                    <p className="truncate text-[11.5px] font-semibold text-[var(--brand-700)]">
                      {reservationsLabel}
                    </p>
                  </div>
                  <Link
                    href="/plan"
                    className="shrink-0 rounded-md bg-[var(--brand-500)] px-2 py-1 text-[11px] font-medium text-white hover:bg-[var(--brand-600)] transition-colors"
                  >
                    Subir
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {mainNavItems.filter((item) => canAccess(item.href)).map((item) => (
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
          {bottomNavItems.filter((item) => canAccess(item.href)).map((item) => (
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
              <AvatarFallback className="text-xs bg-[var(--color-primary-muted)] text-[var(--color-primary-hover)]">
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
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
        active
          ? 'bg-[var(--brand-50)] font-semibold text-[var(--brand-600)]'
          : 'font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-strong)]',
        collapsed && 'justify-center px-0'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-500)] px-1.5 text-[10px] font-bold text-white">
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
