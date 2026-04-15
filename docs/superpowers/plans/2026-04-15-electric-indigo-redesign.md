# Electric Indigo UI/UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire Turnly admin app with "Electric Indigo" aesthetic — gradient accents, dark sidebar, glassmorphism, micro-animations.

**Architecture:** Pure visual redesign — no logic, API, or data flow changes. All modifications are CSS variables, Tailwind classes, and JSX structure. Existing component APIs and data fetching remain unchanged.

**Tech Stack:** Next.js + Tailwind CSS 4 + shadcn/ui + Lucide icons (all already in place).

**Spec:** `docs/superpowers/specs/2026-04-15-electric-indigo-redesign.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/globals.css` | Color tokens, shadows, animations, FullCalendar theme |
| Modify | `src/app/page.tsx` | Landing page redesign |
| Modify | `src/app/(auth)/layout.tsx` | Auth layout — immersive gradient |
| Modify | `src/app/(auth)/login/page.tsx` | Login glassmorphism card |
| Modify | `src/components/layout/Sidebar.tsx` | Dark sidebar |
| Modify | `src/components/layout/MobileSidebar.tsx` | Dark mobile sidebar |
| Modify | `src/components/layout/TopBar.tsx` | Updated topbar |
| Modify | `src/app/(tenant)/layout.tsx` | Background color update |
| Modify | `src/app/(tenant)/dashboard/page.tsx` | Dashboard cards + status colors |
| Modify | `src/app/(tenant)/reservations/page.tsx` | Filter chips + calendar theme |
| Modify | `src/app/(tenant)/clients/page.tsx` | Table hover + avatar styles |
| Modify | `src/app/(tenant)/services/page.tsx` | Service cards styling |
| Modify | `src/app/(tenant)/team/page.tsx` | Team cards + active pulse |
| Modify | `src/app/(tenant)/reports/page.tsx` | Chart colors + metric cards |
| Modify | `src/app/(tenant)/settings/page.tsx` | Form styling + toggle colors |
| Modify | `src/app/(tenant)/service-log/page.tsx` | Table + card styling |

---

## Task 1: Global Theme — Color Tokens, Shadows, Animations

**Files:**
- Modify: `src/app/globals.css` (entire file)

- [ ] **Step 1: Replace all CSS variables in `:root` with Electric Indigo palette**

Replace the `:root` block with:

```css
:root {
  --background: #F8FAFC;
  --foreground: #0F172A;
  --card: #FFFFFF;
  --card-foreground: #0F172A;
  --popover: #FFFFFF;
  --popover-foreground: #0F172A;
  --primary: #6366F1;
  --primary-foreground: #FFFFFF;
  --secondary: #F1F5F9;
  --secondary-foreground: #334155;
  --muted: #F1F5F9;
  --muted-foreground: #64748B;
  --accent: #8B5CF6;
  --accent-foreground: #FFFFFF;
  --destructive: #EF4444;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --ring: #6366F1;
  --chart-1: #6366F1;
  --chart-2: #06B6D4;
  --chart-3: #10B981;
  --chart-4: #8B5CF6;
  --chart-5: #F59E0B;
  --radius: 1rem;
  --sidebar: #0F172A;
  --sidebar-foreground: #94A3B8;
  --sidebar-primary: #FFFFFF;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: rgba(255,255,255,0.1);
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: rgba(255,255,255,0.05);
  --sidebar-ring: #6366F1;
}
```

- [ ] **Step 2: Update the FullCalendar theme variables**

Replace `.fc-bankdash` root variables with:

```css
.fc-bankdash {
  --fc-border-color: #E2E8F0;
  --fc-button-bg-color: #FFFFFF;
  --fc-button-border-color: #E2E8F0;
  --fc-button-text-color: #0F172A;
  --fc-button-hover-bg-color: #EEF2FF;
  --fc-button-hover-border-color: #6366F1;
  --fc-button-active-bg-color: #6366F1;
  --fc-button-active-border-color: #6366F1;
  --fc-button-active-text-color: #FFFFFF;
  --fc-today-bg-color: #EEF2FF;
  --fc-page-bg-color: #FFFFFF;
  --fc-neutral-bg-color: #F8FAFC;
  --fc-event-border-color: transparent;
}
```

Update `.fc-bankdash .fc-toolbar-title` color to `#0F172A`.
Update `.fc-bankdash .fc-col-header-cell-cushion` color to `#64748B`.
Update `.fc-bankdash .fc-daygrid-day-number` color to `#0F172A`.
Update `.fc-bankdash .fc-day-today .fc-daygrid-day-number` bg to `#6366F1`.

- [ ] **Step 3: Add custom utility classes for shadows and animations**

Add after the existing `@layer utilities` block:

```css
@layer utilities {
  .shadow-card {
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(99,102,241,0.06);
  }
  .shadow-card-hover {
    box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 8px 24px rgba(99,102,241,0.10);
  }
  .shadow-elevated {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(99,102,241,0.12);
  }
  .btn-gradient {
    background: linear-gradient(to right, #6366F1, #7C3AED);
  }
  .btn-gradient:hover {
    background: linear-gradient(to right, #4F46E5, #6D28D9);
  }
  .glass {
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.2);
  }
  .glass-dark {
    background: rgba(0,0,0,0.2);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.1);
  }
}

@keyframes mesh {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.animate-mesh {
  background-size: 200% 200%;
  animation: mesh 15s ease infinite;
}
```

- [ ] **Step 4: Verify — run dev server and check no build errors**

Run: `cd apps/admin && npm run dev`
Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/globals.css
git commit -m "style: update global theme to Electric Indigo palette"
```

---

## Task 2: Landing Page Redesign

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite the landing page with gradient hero, glass features, CTA section**

Replace the entire content of `page.tsx` with:

```tsx
import Link from 'next/link';
import { CalendarCheck, Building2, LayoutDashboard, Sparkles, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-slate-900 tracking-tight">Turnly</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Iniciar sesion
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 btn-gradient text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-32 pb-24 min-h-[80vh] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 animate-mesh overflow-hidden">
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-white/90 text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            La plataforma #1 de reservas
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight mb-6">
            Gestiona tu negocio, acepta reservas online
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto mb-10">
            Turnly es la plataforma de citas y servicios para cualquier negocio
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-white text-indigo-600 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors shadow-elevated"
            >
              Registra tu negocio gratis
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 glass text-white text-sm font-semibold rounded-full hover:bg-white/20 transition-colors"
            >
              Iniciar sesion
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4 tracking-tight">
            Todo lo que necesitas
          </h2>
          <p className="text-slate-500 text-center mb-16 max-w-xl mx-auto">
            Herramientas poderosas para gestionar tu negocio de forma eficiente
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: CalendarCheck,
                title: 'Reservas online',
                desc: 'Tus clientes reservan desde cualquier lugar, 24/7',
              },
              {
                icon: Building2,
                title: 'Multi-negocio',
                desc: 'Barberias, spas, consultorios, gimnasios y mas',
              },
              {
                icon: LayoutDashboard,
                title: 'Panel de administracion',
                desc: 'Gestiona servicios, equipo y reportes en un solo lugar',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-8 border border-slate-200/50 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl btn-gradient mb-5">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="px-6 py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-slate-400 uppercase tracking-widest font-medium mb-3">
            Negocios que confian en Turnly
          </p>
          <p className="text-4xl font-bold text-slate-900">+500 negocios activos</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
              Empieza gratis hoy
            </h2>
            <p className="text-white/70 mb-8">Sin tarjeta de credito requerida</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-600 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-slate-400 border-t border-slate-200/50">
        &copy; 2026 Turnly. Todos los derechos reservados.
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser at `http://localhost:3000`**

Expected: gradient hero with mesh animation, glass badge, white/glass buttons, feature cards with indigo gradient icons, social proof counter, gradient CTA card, glassmorphism nav on scroll.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/page.tsx
git commit -m "style: redesign landing page with Electric Indigo hero and glass effects"
```

---

## Task 3: Auth Layout — Immersive Gradient

**Files:**
- Modify: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Replace auth layout with full-screen gradient + glassmorphism card wrapper**

```tsx
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 animate-mesh px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Turnly</h1>
          <p className="text-white/60 mt-1">Gestion de citas y servicios</p>
        </div>
        <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-elevated p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(auth\)/layout.tsx
git commit -m "style: auth layout with immersive gradient and glass card"
```

---

## Task 4: Login Page — Glass Styling

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Update login page to use transparent inputs on glass background**

Replace the entire return statement (keep all logic unchanged above line 49):

```tsx
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="bg-red-500/20 text-white text-sm p-3 rounded-lg border border-red-400/30">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-white/80">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="tu@email.com"
          className="w-full h-11 bg-white/5 border border-white/10 rounded-lg px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-red-300">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-white/80">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          className="w-full h-11 bg-white/5 border border-white/10 rounded-lg px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-red-300">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-white text-indigo-600 font-semibold text-sm rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-sm text-white/60 text-center">
        No tienes cuenta?{' '}
        <Link href="/register" className="text-white hover:underline font-medium">
          Registrate
        </Link>
      </p>
    </form>
  );
```

Remove the Card, CardHeader, CardTitle, CardContent, CardFooter imports (no longer used). Remove Button and Input imports if no longer needed. Keep all other imports.

- [ ] **Step 2: Verify at `http://localhost:3000/login`**

Expected: full-screen animated gradient, glassmorphism card, transparent inputs, white submit button, white text throughout.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(auth\)/login/page.tsx
git commit -m "style: login page with glass inputs on immersive gradient"
```

---

## Task 5: Dark Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MobileSidebar.tsx`

- [ ] **Step 1: Update Sidebar.tsx — dark background, gradient active states**

Replace the `return` JSX (keep all logic above unchanged):

```tsx
  return (
    <aside className="hidden lg:flex lg:flex-col w-64 h-screen sticky top-0 bg-[#0F172A]">
      {/* Logo */}
      <div className="px-6 py-5">
        <h2 className="text-xl font-bold text-white tracking-tight">Turnly</h2>
      </div>

      {/* Search */}
      <div className="mx-4 my-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full h-9 bg-white/5 border border-white/5 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Menu section */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-6 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
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
                  'flex items-center mx-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200',
                  isActive
                    ? 'bg-white/10 text-white font-medium border-l-[3px] border-indigo-500'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
                )}
              >
                <Icon className={cn('h-5 w-5 mr-3 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Settings section */}
      {visibleSettingsItems.length > 0 && (
        <div className="mt-auto border-t border-white/5 pt-4 pb-6">
          <p className="px-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
            Configuracion
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
                    'flex items-center mx-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200',
                    isActive
                      ? 'bg-white/10 text-white font-medium border-l-[3px] border-indigo-500'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
                  )}
                >
                  <Icon className={cn('h-5 w-5 mr-3 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
```

- [ ] **Step 2: Update MobileSidebar.tsx — same dark style**

Apply the same changes to MobileSidebar.tsx:
- Root `<div>`: change `bg-white` to `bg-[#0F172A]`
- Logo `<h2>`: change `text-[#343C6A]` to `text-white`
- Search input: same classes as Sidebar step 1
- Section labels: change `text-[#718EBF]` to `text-slate-500`
- Nav items: same active/inactive classes as Sidebar step 1
- Border: change `border-[#DFE5EE]` to `border-white/5`

- [ ] **Step 3: Verify — navigate to `/dashboard` and check sidebar**

Expected: dark slate-900 sidebar, white logo, transparent search, slate-400 inactive items, white/10% bg on active with indigo left border.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/layout/Sidebar.tsx apps/admin/src/components/layout/MobileSidebar.tsx
git commit -m "style: dark sidebar with gradient active states"
```

---

## Task 6: TopBar Update

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Update TopBar styling — backdrop-blur, indigo avatar, page title**

Changes to apply:
- `<header>`: change `border-[#DFE5EE] bg-white` to `border-slate-200/50 bg-white/80 backdrop-blur-xl`
- Mobile page title: change `text-[#343C6A]` to `text-slate-900`
- Bell/Settings buttons: change `text-[#718EBF] hover:text-[#343C6A]` to `text-slate-400 hover:text-slate-700`
- Avatar: change `bg-[#396AFF]` (both places) to `btn-gradient` (the gradient utility class)
- Add page title for desktop: in the `<div className="hidden lg:block flex-1" />`, replace with:
  ```tsx
  <div className="hidden lg:flex flex-1 items-center">
    {pageTitle && (
      <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
    )}
  </div>
  ```
- Menu icon: change `text-[#343C6A]` to `text-slate-700`

- [ ] **Step 2: Verify — check topbar on desktop and mobile**

Expected: frosted glass topbar, page title on left (desktop), indigo gradient avatar, muted bell/settings icons.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/layout/TopBar.tsx
git commit -m "style: topbar with backdrop blur and gradient avatar"
```

---

## Task 7: Tenant Layout Background

**Files:**
- Modify: `src/app/(tenant)/layout.tsx`

- [ ] **Step 1: Update background color and spinner**

Changes:
- Line 82: change `border-blue-500` to `border-indigo-500` in the loading spinner
- Line 102: change `bg-[#F5F7FA]` to `bg-[#F8FAFC]`

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/layout.tsx
git commit -m "style: tenant layout background to slate-50"
```

---

## Task 8: Dashboard Page

**Files:**
- Modify: `src/app/(tenant)/dashboard/page.tsx`

- [ ] **Step 1: Update status colors map**

Replace `statusColors` (lines 13-20):

```tsx
const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-100 text-slate-700',
};
```

- [ ] **Step 2: Update stat cards styling**

For each of the 4 stat cards, update:
- Container: change `bg-white rounded-xl shadow-sm p-6` to `bg-white rounded-2xl shadow-card p-6 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300`
- Icon circles: update backgrounds to gradient style:
  - Card 1 (reservations): `bg-gradient-to-br from-indigo-500 to-violet-500` with `text-white` icon
  - Card 2 (services): `bg-gradient-to-br from-cyan-500 to-emerald-500` with `text-white` icon
  - Card 3 (revenue): `bg-gradient-to-br from-amber-500 to-orange-500` with `text-white` icon
  - Card 4 (total): `bg-gradient-to-br from-violet-500 to-purple-500` with `text-white` icon
- Remove old color classes from icons (e.g., `text-[#396AFF]`, `text-green-600`, etc.)
- Change stat value `text-gray-900` to `text-slate-900`
- Change secondary text `text-[#718EBF]` to `text-slate-500`

- [ ] **Step 3: Update upcoming reservations card**

- Container: change `bg-white rounded-xl shadow-sm` to `bg-white rounded-2xl shadow-card`
- Header border: change `border-gray-100` to `border-slate-100`
- "Ver todas" button: change `text-[#396AFF] hover:text-[#1814F3] hover:bg-blue-50` to `text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50`
- Reservation rows: change `bg-gray-50` to `bg-slate-50/50 hover:bg-indigo-50/30 transition-colors`
- Secondary text in rows: change `text-[#718EBF]` to `text-slate-500`

- [ ] **Step 4: Update page header buttons**

Change both buttons: `bg-[#396AFF] hover:bg-[#1814F3]` to `btn-gradient`

- [ ] **Step 5: Verify at `/dashboard`**

Expected: gradient icon circles on stat cards, hover elevation, indigo-themed status badges, glass-smooth transitions.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/dashboard/page.tsx
git commit -m "style: dashboard with gradient stat cards and indigo status badges"
```

---

## Task 9: Reservations Page — Filter Chips + Theme

**Files:**
- Modify: `src/app/(tenant)/reservations/page.tsx`

- [ ] **Step 1: Replace Select-based filters with chip-style buttons**

Replace the filters section (the `<div className="flex flex-wrap items-center gap-3">` block, lines 133-170) with:

```tsx
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
              status === opt.value
                ? 'btn-gradient text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
```

Add `import { cn } from '@/lib/utils';` if not already imported.

- [ ] **Step 2: Update calendar container**

Change `bg-white rounded-[1.5625rem] p-4 shadow-sm` to `bg-white rounded-2xl p-4 shadow-card`.

- [ ] **Step 3: Update header text colors**

- `text-[#343C6A]` to `text-slate-900`
- `text-[#718EBF]` to `text-slate-500`

- [ ] **Step 4: Verify at `/reservations`**

Expected: pill-shaped filter chips (gradient when active, slate when inactive), rounded calendar card with indigo-tinted shadow.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/reservations/page.tsx
git commit -m "style: reservations with chip filters and indigo calendar theme"
```

---

## Task 10: Clients Page

**Files:**
- Modify: `src/app/(tenant)/clients/page.tsx`

- [ ] **Step 1: Update color references throughout the file**

Apply these replacements across the entire file:
- All `text-[#343C6A]` → `text-slate-900`
- All `text-[#718EBF]` → `text-slate-500`
- All `bg-[#396AFF]` → `bg-indigo-500` (or `btn-gradient` for buttons)
- All `hover:bg-[#1814F3]` → `hover:bg-indigo-600`
- All `bg-[#E7EDFF]` → `bg-indigo-50`
- All `text-[#396AFF]` → `text-indigo-500`
- All `border-[#DFE5EE]` → `border-slate-200`
- All `bg-[#F5F7FA]` → `bg-slate-50`
- All `rounded-[1.5625rem]` → `rounded-2xl`
- All `shadow-sm` on cards → `shadow-card`
- Table row hover: add `hover:bg-indigo-50/30 transition-colors` to rows

- [ ] **Step 2: Verify at `/clients`**

Expected: consistent indigo theme, hover effects on table rows, rounded cards with tinted shadows.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/clients/page.tsx
git commit -m "style: clients page with indigo theme"
```

---

## Task 11: Services Page

**Files:**
- Modify: `src/app/(tenant)/services/page.tsx`

- [ ] **Step 1: Apply same color replacements as Task 10**

Same global replacements:
- `text-[#343C6A]` → `text-slate-900`
- `text-[#718EBF]` → `text-slate-500`
- `bg-[#396AFF]` → gradient for buttons (`btn-gradient`)
- `hover:bg-[#1814F3]` → remove (btn-gradient handles hover)
- `border-[#DFE5EE]` → `border-slate-200`
- `bg-[#F5F7FA]` → `bg-slate-50`
- `rounded-[1.5625rem]` → `rounded-2xl`
- `shadow-sm` on cards → `shadow-card`
- Add `hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300` to service cards

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/services/page.tsx
git commit -m "style: services page with indigo theme and card hover"
```

---

## Task 12: Team Page

**Files:**
- Modify: `src/app/(tenant)/team/page.tsx`

- [ ] **Step 1: Apply color replacements + add active pulse**

Same color replacements as Tasks 10-11, plus:
- Active status dots: add `animate-pulse` to green dots for active team members
- Team member cards: add `hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300`
- Avatar backgrounds: change to `bg-gradient-to-br from-indigo-500 to-violet-500` for gradient avatars

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/team/page.tsx
git commit -m "style: team page with gradient avatars and active pulse"
```

---

## Task 13: Reports Page

**Files:**
- Modify: `src/app/(tenant)/reports/page.tsx`

- [ ] **Step 1: Apply color replacements**

Same global replacements as previous tasks. Additionally:
- Metric cards at top: same gradient icon circle treatment as dashboard stat cards
- Chart color references: ensure chart-1 through chart-5 are used (they now map to indigo, cyan, emerald, violet, amber via globals.css)

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/reports/page.tsx
git commit -m "style: reports page with indigo theme"
```

---

## Task 14: Settings Page

**Files:**
- Modify: `src/app/(tenant)/settings/page.tsx`

- [ ] **Step 1: Apply color replacements**

Same global replacements. Additionally:
- Toggle switches: ensure active color uses indigo (if custom styled)
- Save button: change to `btn-gradient text-white`
- Form sections: ensure cards use `shadow-card` and `rounded-2xl`
- Focus rings on inputs: they'll inherit from `--ring: #6366F1` automatically

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/settings/page.tsx
git commit -m "style: settings page with indigo theme"
```

---

## Task 15: Service Log Page

**Files:**
- Modify: `src/app/(tenant)/service-log/page.tsx`

- [ ] **Step 1: Apply color replacements**

Same global replacements as previous tasks.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(tenant\)/service-log/page.tsx
git commit -m "style: service log page with indigo theme"
```

---

## Task 16: Final Visual Verification

- [ ] **Step 1: Full walkthrough of all pages**

Navigate through each page and verify:
1. `http://localhost:3000` — Landing page: gradient hero, glass nav, feature cards, CTA
2. `http://localhost:3000/login` — Immersive gradient, glass card, transparent inputs
3. `http://localhost:3000/dashboard` — Dark sidebar, gradient stat cards, status badges
4. `http://localhost:3000/reservations` — Chip filters, indigo calendar
5. `http://localhost:3000/clients` — Table hover effects, indigo accents
6. `http://localhost:3000/services` — Card hover elevation
7. `http://localhost:3000/team` — Gradient avatars, active pulse
8. `http://localhost:3000/reports` — Metric cards, chart colors
9. `http://localhost:3000/settings` — Form styling, gradient save button
10. `http://localhost:3000/service-log` — Consistent theme

- [ ] **Step 2: Check mobile responsive**

Resize browser to mobile width and verify:
- Landing: stacked layout, hero readable
- Login: card takes full width with margin
- Dashboard: sidebar hidden, hamburger menu works, stat cards scroll horizontally
- Mobile sidebar: dark theme matches desktop

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "style: final polish and responsive fixes for Electric Indigo redesign"
```
