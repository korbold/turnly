'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [superAdminMode, setSuperAdminMode] = useState(false);
  const [viewingSlug, setViewingSlug] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (localStorage.getItem('super_admin_mode') === 'true') {
      setSuperAdminMode(true);
      setViewingSlug(localStorage.getItem('tenant_slug') ?? '');
    }
    setReady(true);
  }, [router]);

  function handleBackToPanel() {
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('super_admin_mode');
    router.push('/super-admin');
  }

  if (!ready) {
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
      <div className={`flex min-h-screen bg-gray-50${superAdminMode ? ' pt-10' : ''}`}>
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
