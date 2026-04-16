'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { BottomTabs } from './bottom-tabs';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function AppShell({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px)');

  // Sidebar collapsed state: default collapsed on tablet, expanded on desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isTablet && !isDesktop) {
      setSidebarCollapsed(true);
    } else if (isDesktop) {
      setSidebarCollapsed(false);
    }
  }, [isDesktop, isTablet]);

  // Mobile: topbar + content + bottom tabs
  if (!isTablet) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-50">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
          {children}
        </main>
        <BottomTabs />
      </div>
    );
  }

  // Tablet + Desktop: sidebar + topbar + content
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
