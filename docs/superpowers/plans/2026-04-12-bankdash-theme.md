# BankDash Theme Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark-sidebar Alpha theme with the BankDash design system (white sidebar, Inter font, new color palette, rounded cards).

**Architecture:** Pure CSS/UI change across 5 files. CSS variables in `globals.css` propagate to all shadcn components automatically. Font swap in root layout. Sidebar and TopBar get hardcoded color replacements.

**Tech Stack:** Next.js 16, Tailwind CSS v4, shadcn/ui, Inter font from `next/font/google`

---

### Task 1: Update CSS Variables in globals.css

**Files:**
- Modify: `apps/admin/src/app/globals.css`

- [ ] **Step 1: Replace `:root` color variables**

Replace the entire `:root` block in `apps/admin/src/app/globals.css` with:

```css
:root {
  --background: #F5F7FA;
  --foreground: #343C6A;
  --card: #FFFFFF;
  --card-foreground: #343C6A;
  --popover: #FFFFFF;
  --popover-foreground: #343C6A;
  --primary: #396AFF;
  --primary-foreground: #FFFFFF;
  --secondary: #E7EDFF;
  --secondary-foreground: #343C6A;
  --muted: #EDF1F7;
  --muted-foreground: #718EBF;
  --accent: #E7EDFF;
  --accent-foreground: #343C6A;
  --destructive: #FF4B4A;
  --border: #DFE5EE;
  --input: #DFE5EE;
  --ring: #396AFF;
  --chart-1: #396AFF;
  --chart-2: #41D4A8;
  --chart-3: #FFBB38;
  --chart-4: #FF82AC;
  --chart-5: #FC7900;
  --radius: 1.5625rem;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #B1B1B1;
  --sidebar-primary: #1814F3;
  --sidebar-primary-foreground: #1814F3;
  --sidebar-accent: #E7EDFF;
  --sidebar-accent-foreground: #343C6A;
  --sidebar-border: #DFE5EE;
  --sidebar-ring: #396AFF;
}
```

- [ ] **Step 2: Verify the `@theme inline` block**

The `@theme inline` block already maps `--color-*` to `var(--*)`. No changes needed there. Confirm `--font-mono` reference in line 11 — it will be removed in Task 2, so update the `@theme inline` block:

Replace line 11:
```css
  --font-mono: var(--font-geist-mono);
```
with:
```css
  --font-mono: var(--font-sans);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/app/globals.css
git commit -m "style: update CSS variables to BankDash theme colors and radius"
```

---

### Task 2: Swap Font from Geist to Inter

**Files:**
- Modify: `apps/admin/src/app/layout.tsx`

- [ ] **Step 1: Replace font imports and configuration**

Replace the full content of `apps/admin/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Turnly",
  description: "Gestión de citas y servicios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Key changes:
- `Geist` and `Geist_Mono` → `Inter`
- Variable name `--font-geist-sans` → `--font-sans` (direct mapping to CSS var)
- Removed mono font class from `<html>`
- Added `font-sans` to `<body>` for explicit font application

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/app/layout.tsx
git commit -m "style: swap Geist font to Inter for BankDash theme"
```

---

### Task 3: Redesign Sidebar to BankDash Light Style

**Files:**
- Modify: `apps/admin/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace full Sidebar component**

Replace the entire content of `apps/admin/src/components/layout/Sidebar.tsx` with:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/components/layout/Sidebar.tsx
git commit -m "style: redesign sidebar to BankDash white/light theme"
```

---

### Task 4: Update MobileSidebar to Match New Style

**Files:**
- Modify: `apps/admin/src/components/layout/MobileSidebar.tsx`

- [ ] **Step 1: Replace full MobileSidebar component**

Replace the entire content of `apps/admin/src/components/layout/MobileSidebar.tsx` with:

```tsx
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

interface MobileSidebarProps {
  onNavigate: () => void;
}

export function MobileSidebar({ onNavigate }: MobileSidebarProps) {
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
    <div className="flex flex-col h-full bg-white">
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
                onClick={onNavigate}
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
                  onClick={onNavigate}
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
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/components/layout/MobileSidebar.tsx
git commit -m "style: update mobile sidebar to BankDash white theme"
```

---

### Task 5: Update TopBar and Tenant Layout

**Files:**
- Modify: `apps/admin/src/components/layout/TopBar.tsx`
- Modify: `apps/admin/src/app/(tenant)/layout.tsx`

- [ ] **Step 1: Replace TopBar component**

Replace the entire content of `apps/admin/src/components/layout/TopBar.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User, Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logout } from '@/lib/api/auth';
import { MobileSidebar } from './MobileSidebar';

export function TopBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#DFE5EE] bg-white">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="lg:hidden" />}
          >
            <Menu className="h-5 w-5 text-[#343C6A]" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <MobileSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1" />

        {/* Notification bell */}
        <Button variant="ghost" size="icon" className="text-[#718EBF] hover:text-[#343C6A]">
          <Bell className="h-5 w-5" />
        </Button>

        {/* Settings icon */}
        <Button variant="ghost" size="icon" className="text-[#718EBF] hover:text-[#343C6A]">
          <Settings className="h-5 w-5" />
        </Button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" />
            }
          >
            <Avatar className="h-9 w-9 bg-[#396AFF]">
              <AvatarFallback className="bg-[#396AFF] text-white text-sm font-medium">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update hardcoded background in tenant layout**

In `apps/admin/src/app/(tenant)/layout.tsx`, replace:

```tsx
<div className={`flex min-h-screen bg-[#F1F6FD]${superAdminMode ? ' pt-10' : ''}`}>
```

with:

```tsx
<div className={`flex min-h-screen bg-[#F5F7FA]${superAdminMode ? ' pt-10' : ''}`}>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/components/layout/TopBar.tsx apps/admin/src/app/\(tenant\)/layout.tsx
git commit -m "style: update topbar and layout background to BankDash theme"
```

---

### Task 6: Visual Verification

- [ ] **Step 1: Run the dev server**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/admin
npm run dev
```

- [ ] **Step 2: Verify in browser**

Check the following pages visually:
- `/dashboard` — white sidebar, Inter font, `#F5F7FA` background, 25px card radius
- `/reservations` — same layout consistency
- `/settings` — sidebar active state shows blue indicator
- Mobile view (< 1024px) — hamburger opens white mobile sidebar
- Cards use rounded corners (25px)
- All text uses Inter font family

- [ ] **Step 3: Check for remaining old colors**

Search for any remaining hardcoded old theme colors in the admin app:

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
grep -r "#050417\|#171365\|#304FDB\|#1a1a2e\|#F1F6FD\|#6A84A8\|#E2E8F0\|#EEF2FF\|#E8ECF4" apps/admin/src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

If any results appear in the 5 modified files, fix them. Results in other files (page components, other UI) are out of scope for this plan — they use CSS variables via Tailwind classes and will inherit the new theme automatically.
