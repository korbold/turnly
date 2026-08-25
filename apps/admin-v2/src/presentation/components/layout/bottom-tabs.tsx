'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Plus,
  BarChart3,
  MoreHorizontal,
  Users,
  Scissors,
  UserPlus,
  Settings,
  Clock,
  ClipboardList,
  Package,
  Receipt,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/presentation/components/ui/sheet';

interface TabItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const tabs: (TabItem | 'fab')[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Reservas', href: '/reservations', icon: Calendar },
  'fab',
  { label: 'Registro', href: '/service-logs', icon: ClipboardList },
  { label: 'Más', href: '#more', icon: MoreHorizontal },
];

const quickActions = [
  { label: 'Nueva Reserva', icon: Calendar, href: '/reservations?create=true' },
  { label: 'Registrar Servicio', icon: ClipboardList, href: '/service-logs?create=true' },
  { label: 'Bloquear Horario', icon: Clock, href: '/settings' },
];

const moreItems = [
  { label: 'Clientes', icon: Users, href: '/clients' },
  { label: 'Servicios', icon: Scissors, href: '/services' },
  { label: 'Inventario', icon: Package, href: '/inventory' },
  { label: 'Equipo', icon: UserPlus, href: '/team' },
  { label: 'Caja', icon: Wallet, href: '/cash' },
  { label: 'Reportes', icon: BarChart3, href: '/reports' },
  { label: 'Facturas', icon: Receipt, href: '/facturas' },
  { label: 'Mi Plan', icon: CreditCard, href: '/plan' },
  { label: 'Configuración', icon: Settings, href: '/settings' },
];

export function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccess } = usePermissions();
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname?.startsWith(href);

  const visibleMoreItems = moreItems.filter((item) => canAccess(item.href));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex items-center justify-around px-2 h-16">
          {tabs.map((tab, i) => {
            if (tab === 'fab') {
              return (
                <button
                  key="fab"
                  onClick={() => setFabOpen(true)}
                  className="flex items-center justify-center -mt-5"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 transition-transform">
                    <Plus className="h-6 w-6" />
                  </div>
                </button>
              );
            }

            const active = tab.href === '#more' ? moreOpen : isActive(tab.href);
            const Icon = tab.icon;

            return (
              <button
                key={tab.href}
                onClick={() => {
                  if (tab.href === '#more') {
                    setMoreOpen(true);
                  } else {
                    router.push(tab.href);
                  }
                }}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors',
                  active
                    ? 'text-[var(--color-primary)] font-bold'
                    : 'text-zinc-400'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'fill-[var(--color-primary)]/20')} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* FAB Quick Actions Sheet */}
      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Acciones rápidas</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.href}
                  onClick={() => {
                    setFabOpen(false);
                    router.push(action.href);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <Icon className="h-5 w-5 text-[var(--color-primary)]" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* More Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Más opciones</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {visibleMoreItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(item.href);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <Icon className="h-5 w-5 text-zinc-500" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
