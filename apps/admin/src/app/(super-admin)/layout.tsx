'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SuperAdminSidebar } from '@/components/layout/SuperAdminSidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('is_super_admin') !== 'true') {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
