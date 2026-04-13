'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getMe } from '@/lib/api/auth';
import { getTenantSettings } from '@/lib/api/tenant';
import { canAccess, mergePermissions, type PermissionsConfig } from '@/lib/constants/permissions';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

const PATH_TO_SECTION: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/reservations': 'reservations',
  '/service-log': 'service-log',
  '/clients': 'clients',
  '/services': 'services',
  '/team': 'team',
  '/reports': 'reports',
  '/settings': 'settings',
};

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [superAdminMode, setSuperAdminMode] = useState(false);
  const [viewingSlug, setViewingSlug] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [customPerms, setCustomPerms] = useState<PermissionsConfig | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (localStorage.getItem('super_admin_mode') === 'true') {
      setSuperAdminMode(true);
      setViewingSlug(localStorage.getItem('tenant_slug') ?? '');
    }

    // Fetch user role and tenant permissions for access control
    Promise.all([getMe(), getTenantSettings()])
      .then(([me, tenant]) => {
        setUserRole(me.role ?? null);
        const settings = (tenant as Record<string, unknown>)?.settings as Record<string, unknown> | undefined;
        if (settings?.permissions) {
          setCustomPerms(settings.permissions as PermissionsConfig);
        }
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, [router]);

  // Check access whenever pathname or role changes
  useEffect(() => {
    if (!ready || !userRole) return;
    if (superAdminMode) return;

    const basePath = '/' + (pathname.split('/')[1] ?? '');
    const section = PATH_TO_SECTION[basePath];
    const perms = mergePermissions(customPerms);
    if (section && !canAccess(userRole, section, perms)) {
      setAccessDenied(true);
      router.replace('/dashboard');
    } else {
      setAccessDenied(false);
    }
  }, [pathname, userRole, ready, superAdminMode, router]);

  function handleBackToPanel() {
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('super_admin_mode');
    router.push('/super-admin');
  }

  if (!ready || accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {superAdminMode && (
        <div className="fixed top-0 left-0 right-0 z-50 h-10 bg-amber-500 text-white flex items-center justify-between px-4">
          <span className="text-sm font-medium">
            Modo administrador — Viendo: {viewingSlug}
          </span>
          <button
            onClick={handleBackToPanel}
            className="text-sm font-semibold underline hover:no-underline"
          >
            Volver al panel
          </button>
        </div>
      )}
      <div className={`flex min-h-screen bg-[#F5F7FA]${superAdminMode ? ' pt-10' : ''}`}>
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
