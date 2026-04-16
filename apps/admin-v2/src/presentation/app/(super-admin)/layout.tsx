'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, LogOut } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useLogout } from '@/presentation/hooks/use-auth';
import { Button } from '@/presentation/components/ui/button';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
  { label: 'Tenants', href: '/super-admin/tenants', icon: Building2 },
  { label: 'Users', href: '/super-admin/users', icon: Users },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-900">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-white">
            SA
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Turnly</p>
            <p className="text-xs text-zinc-400">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/super-admin'
              ? pathname === '/super-admin'
              : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-zinc-800 text-amber-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-zinc-800 px-2 py-3">
          <button
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {children}
      </main>
    </div>
  );
}
