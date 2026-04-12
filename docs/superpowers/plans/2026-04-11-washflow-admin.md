# WashFlow Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js 15 admin panel for tenant owners and staff to manage reservations, wash logs, services, employees, and view reports.

**Architecture:** Next.js 15 App Router with route groups for auth, onboarding, and tenant sections. Axios API client with Sanctum token auth. TanStack Query for server state. shadcn/ui components. Zod + react-hook-form for validation.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, TanStack React Query, Axios, Zod, react-hook-form

---

### Task 1: Next.js setup + base config

**Files:**
- Create: `apps/admin/` (Next.js project)
- Create: `apps/admin/src/lib/api/client.ts`
- Create: `apps/admin/src/types/*.ts`

- [ ] **Step 1: Create Next.js project**

```bash
cd apps/admin
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-import-alias
```

- [ ] **Step 2: Install dependencies**

```bash
npx shadcn@latest init
npm install @tanstack/react-query axios zod react-hook-form @hookform/resolvers
```

- [ ] **Step 3: Create API client**

Axios instance with baseURL from env, auth token interceptor (localStorage), 401 redirect interceptor. Exact code from spec.

- [ ] **Step 4: Create TypeScript types**

`types/tenant.ts`, `types/reservation.ts`, `types/wash-log.ts`, `types/vehicle.ts`, `types/service.ts`, `types/user.ts`. Match backend API resource shapes.

- [ ] **Step 5: Set up TanStack Query provider**

Create `src/app/providers.tsx` with QueryClientProvider. Wrap root layout.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/
git commit -m "feat(fase-2): Next.js 15 setup with shadcn, React Query, API client"
```

---

### Task 2: Auth layout + login page

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/lib/api/auth.ts`
- Create: `src/lib/auth/config.ts`

- [ ] **Step 1: Create auth API functions**

`login(email, password)`, `register(data)`, `logout()` — call backend endpoints, manage token in localStorage.

- [ ] **Step 2: Create auth layout**

Centered card layout for auth pages. No sidebar.

- [ ] **Step 3: Create login page**

Form with email + password fields (react-hook-form + zod validation). On success, store token, redirect to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): auth layout and login page"
```

---

### Task 3: Onboarding wizard (4 steps)

**Files:**
- Create: `src/app/(onboarding)/register/page.tsx`
- Create: `src/app/(onboarding)/verify-email/page.tsx`
- Create: `src/app/(onboarding)/configure/page.tsx`
- Create: `src/app/(onboarding)/welcome/page.tsx`
- Create: `src/app/(onboarding)/layout.tsx`
- Create: `src/components/onboarding/OnboardingWizard.tsx`
- Create: `src/components/onboarding/SlugChecker.tsx`

- [ ] **Step 1: Create onboarding layout**

Stepper UI showing 4 steps with active indicator.

- [ ] **Step 2: Create Step 1 — Register**

Form: business name, slug (with real-time SlugChecker), owner name, email, password. SlugChecker calls `GET /api/v1/onboarding/check-slug?slug=xxx` with debounce.

- [ ] **Step 3: Create Step 2 — Verify email**

Token input field. Calls `POST /api/v1/onboarding/verify`.

- [ ] **Step 4: Create Step 3 — Configure**

Add services (name, price, duration). Set business hours (day picker + time range).

- [ ] **Step 5: Create Step 4 — Welcome**

Success message with link to dashboard.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): onboarding wizard with slug checker"
```

---

### Task 4: Tenant layout (sidebar + topbar)

**Files:**
- Create: `src/app/(tenant)/layout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Create Sidebar**

Navigation links: Dashboard, Reservaciones, Libro Diario, Vehículos, Servicios, Equipo, Reportes, Configuración. Active state highlighting. Tenant name at top.

- [ ] **Step 2: Create TopBar**

User name/avatar, logout button. Responsive hamburger for mobile.

- [ ] **Step 3: Create tenant layout**

Sidebar left, content area right. Auth guard — redirect to /login if no token.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): tenant layout with sidebar and topbar"
```

---

### Task 5: Dashboard page

**Files:**
- Create: `src/app/(tenant)/dashboard/page.tsx`
- Create: `src/lib/api/reports.ts`

- [ ] **Step 1: Create reports API functions**

`getDailyReport(date)`, `getWeeklyReport(week)`, `getMonthlyReport(month)`.

- [ ] **Step 2: Create Dashboard page**

Cards: total reservaciones del día (pending/confirmed/completed), total autos lavados hoy, ingresos del día. List: próximas 3 reservaciones. Quick actions: "+ Nueva reservación", "+ Registrar lavado".

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): dashboard with daily stats and quick actions"
```

---

### Task 6: Wash Log (Libro Diario) page

**Files:**
- Create: `src/app/(tenant)/wash-log/page.tsx`
- Create: `src/app/(tenant)/wash-log/new/page.tsx`
- Create: `src/components/wash-log/DailyLogTable.tsx`
- Create: `src/components/wash-log/DailySummaryCard.tsx`
- Create: `src/components/wash-log/WalkInForm.tsx`
- Create: `src/lib/api/wash-log.ts`

- [ ] **Step 1: Create wash-log API functions**

`getWashLogs(date)`, `createWashLog(data)`, `completeWashLog(id)`, `getDailySummary(date)`.

- [ ] **Step 2: Create DailyLogTable**

Columns: hora, placa, servicio, empleado, precio, método de pago, estado. Sortable by time.

- [ ] **Step 3: Create DailySummaryCard**

Total autos, total ingresos, desglose por método de pago (cash/card/transfer).

- [ ] **Step 4: Create wash-log page**

Date picker (defaults to today). DailyLogTable + DailySummaryCard. Button "+ Registrar lavado" → /wash-log/new.

- [ ] **Step 5: Create WalkInForm (new page)**

Select vehicle (search by plate), select service, select employee (washer), payment method, notes. Submit → POST /wash-logs.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): wash log page with daily table, summary, and walk-in form"
```

---

### Task 7: Reservations page

**Files:**
- Create: `src/app/(tenant)/reservations/page.tsx`
- Create: `src/app/(tenant)/reservations/[id]/page.tsx`
- Create: `src/components/reservations/ReservationCard.tsx`
- Create: `src/components/reservations/ReservationForm.tsx`
- Create: `src/lib/api/reservations.ts`

- [ ] **Step 1: Create reservations API functions**

`getReservations(filters)`, `createReservation(data)`, `confirmReservation(id)`, `startReservation(id)`, `completeReservation(id)`, `cancelReservation(id, reason)`, `getAvailableSlots(date, serviceId)`.

- [ ] **Step 2: Create ReservationCard**

Shows: time, client name, vehicle plate, service, status badge (color-coded). Inline action buttons based on current status.

- [ ] **Step 3: Create reservations list page**

Filters: date, status, service. List of ReservationCards. Button "+ Nueva reservación" opens modal/drawer with ReservationForm.

- [ ] **Step 4: Create ReservationForm**

Search client by name/plate, select vehicle, select service, date picker, slot picker (fetches available slots). Submit → POST /reservations.

- [ ] **Step 5: Create reservation detail page**

Full details + action buttons + notes. Status timeline.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): reservations list, detail, and creation form"
```

---

### Task 8: Remaining pages (services, team, vehicles, reports, settings)

**Files:**
- Create: `src/app/(tenant)/services/page.tsx`
- Create: `src/app/(tenant)/team/page.tsx`
- Create: `src/app/(tenant)/vehicles/[id]/page.tsx`
- Create: `src/app/(tenant)/reports/page.tsx`
- Create: `src/app/(tenant)/settings/page.tsx`
- Create: `src/lib/api/services.ts`
- Create: `src/lib/api/users.ts`
- Create: `src/lib/api/vehicles.ts`

- [ ] **Step 1: Create Services page**

CRUD table for services: name, price, duration, active toggle. Add/edit in modal.

- [ ] **Step 2: Create Team page**

List employees with role badges. Invite new member. Change role dropdown.

- [ ] **Step 3: Create Vehicle detail page**

Vehicle info + wash history table.

- [ ] **Step 4: Create Reports page**

Date range selector (daily/weekly/monthly tabs). Summary cards + simple charts (revenue, wash count).

- [ ] **Step 5: Create Settings page**

Business info, business hours editor, timezone.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(fase-2): services, team, vehicles, reports, and settings pages"
```
