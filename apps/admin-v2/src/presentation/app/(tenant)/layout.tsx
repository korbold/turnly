'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from '@/infrastructure/storage/auth-storage';
import { AppShell } from '@/presentation/components/layout/app-shell';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  // Don't render shell until we confirm we have a token (client-side)
  const token =
    typeof window !== 'undefined' ? authStorage.getToken() : null;

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
