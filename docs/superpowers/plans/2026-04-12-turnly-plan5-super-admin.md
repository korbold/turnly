# Plan 5: Super Admin Panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a super admin panel where the platform owner can view all tenants, all users, system stats, and switch into any tenant's dashboard.

**Architecture:** New `(super-admin)` route group in Next.js with its own layout/sidebar. Backend already has SuperAdminController with tenant list/suspend/activate. Need to add users list and stats endpoints. Login redirect based on `is_super_admin`. Switch-tenant stores temporary tenant_slug.

**Tech Stack:** Laravel, Next.js, TanStack Query

**Spec:** `docs/superpowers/specs/2026-04-12-turnly-rebrand-design.md` — Section 10

**Depends on:** Plan 1 (DB + branding), Plans 2-4 (tenant features to manage)

---

## Task 1: Backend — add users list and stats endpoints

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Add users endpoint**

Add a `users()` method to SuperAdminController that returns ALL users with their tenant associations:

```php
public function users(Request $request)
{
    $users = UserModel::with(['tenants' => function ($q) {
        $q->select('tenants.id', 'tenants.name', 'tenants.slug');
    }])
    ->orderBy('created_at', 'desc')
    ->paginate($request->get('per_page', 15));

    return UserResource::collection($users);
}
```

Add necessary imports: `UserModel`, `UserResource`, `Request`.

- [ ] **Step 2: Add stats endpoint**

Add a `stats()` method that returns system-wide counts:

```php
public function stats(): JsonResponse
{
    $stats = [
        'total_tenants' => TenantModel::count(),
        'active_tenants' => TenantModel::where('status', 'active')->count(),
        'total_users' => UserModel::count(),
        'total_reservations' => \App\Infrastructure\Persistence\Models\ReservationModel::withoutGlobalScopes()->count(),
        'total_services' => \App\Infrastructure\Persistence\Models\ServiceModel::withoutGlobalScopes()->count(),
    ];

    return response()->json([
        'data' => $stats,
        'meta' => ['timestamp' => now()->toIso8601String()],
    ]);
}
```

- [ ] **Step 3: Add routes**

In the super_admin route group:
```php
Route::get('users', [SuperAdminController::class, 'users']);
Route::get('stats', [SuperAdminController::class, 'stats']);
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php apps/backend/routes/api.php
git commit -m "feat: add super admin users list and stats endpoints"
```

---

## Task 2: Backend — return is_super_admin in login response

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php`

- [ ] **Step 1: Add is_super_admin to login response**

Read the file first. In the `login()` method, add `is_super_admin` to the user object in the response:

```php
'user' => [
    'id' => $user->id,
    'name' => $user->name,
    'email' => $user->email,
    'is_super_admin' => $user->is_super_admin,
],
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php
git commit -m "feat: return is_super_admin flag in login response"
```

---

## Task 3: Frontend — super admin API client

**Files:**
- Create: `apps/admin/src/lib/api/super-admin.ts`

- [ ] **Step 1: Create super admin API**

```typescript
import api from './client';

export interface SuperAdminTenant {
  id: string;
  slug: string;
  name: string;
  business_type: string;
  plan: string;
  status: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_super_admin: boolean;
  created_at: string;
  role?: string;
  tenants?: Array<{ id: string; name: string; slug: string }>;
}

export interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_reservations: number;
  total_services: number;
}

export async function getStats(): Promise<SystemStats> {
  const response = await api.get('/superadmin/stats');
  return response.data.data;
}

export async function getTenants(params?: { per_page?: number }) {
  const response = await api.get('/superadmin/tenants', { params });
  return response.data;
}

export async function getUsers(params?: { per_page?: number }) {
  const response = await api.get('/superadmin/users', { params });
  return response.data;
}

export async function suspendTenant(id: string) {
  const response = await api.patch(`/superadmin/tenants/${id}/suspend`);
  return response.data;
}

export async function activateTenant(id: string) {
  const response = await api.patch(`/superadmin/tenants/${id}/activate`);
  return response.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/lib/api/super-admin.ts
git commit -m "feat: add super admin API client"
```

---

## Task 4: Frontend — login redirect for super admin

**Files:**
- Modify: `apps/admin/src/app/(auth)/login/page.tsx`
- Modify: `apps/admin/src/lib/api/auth.ts`

- [ ] **Step 1: Update auth types**

In `apps/admin/src/lib/api/auth.ts`, update LoginResponse to include `is_super_admin`:

The login response already includes `tenant` from Plan 1. Add `is_super_admin` to the user object type. Also save `is_super_admin` to localStorage:

```typescript
const { token, tenant } = response.data.data;
const isSuperAdmin = response.data.data.user.is_super_admin;
localStorage.setItem('auth_token', token);
if (isSuperAdmin) {
  localStorage.setItem('is_super_admin', 'true');
} else if (tenant?.slug) {
  localStorage.setItem('tenant_slug', tenant.slug);
}
```

- [ ] **Step 2: Update login redirect**

In login page, after successful login, check if super admin:

```typescript
const result = await login(data.email, data.password);
if (result.data.user.is_super_admin) {
  router.push('/super-admin');
} else {
  router.push('/dashboard');
}
```

- [ ] **Step 3: Update logout**

In `auth.ts` logout function, also remove `is_super_admin` from localStorage.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/(auth)/login/page.tsx apps/admin/src/lib/api/auth.ts
git commit -m "feat: redirect super admin to /super-admin on login"
```

---

## Task 5: Frontend — super admin layout and sidebar

**Files:**
- Create: `apps/admin/src/app/(super-admin)/layout.tsx`
- Create: `apps/admin/src/components/layout/SuperAdminSidebar.tsx`

- [ ] **Step 1: Create SuperAdminSidebar**

Similar to the tenant Sidebar but with different nav items:

```typescript
const navItems = [
  { href: '/super-admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super-admin/tenants', label: 'Negocios', icon: Building2 },
  { href: '/super-admin/users', label: 'Usuarios', icon: Users },
];
```

Header: "Turnly" with "Super Admin" subtitle.

- [ ] **Step 2: Create super admin layout**

Similar to tenant layout but:
- Uses SuperAdminSidebar
- Auth check: verify `is_super_admin` in localStorage, redirect to `/login` if not
- Does NOT need tenant_slug

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/(super-admin)/layout.tsx apps/admin/src/components/layout/SuperAdminSidebar.tsx
git commit -m "feat: create super admin layout and sidebar"
```

---

## Task 6: Frontend — super admin dashboard page

**Files:**
- Create: `apps/admin/src/app/(super-admin)/page.tsx`

- [ ] **Step 1: Create dashboard**

A 'use client' page that shows system stats using `getStats()`:
- 5 stat cards in a grid (2 cols mobile, 5 cols desktop):
  - Total negocios
  - Negocios activos
  - Total usuarios
  - Total reservaciones
  - Total servicios
- Each card: icon, count (large number), label

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(super-admin)/page.tsx
git commit -m "feat: create super admin dashboard with system stats"
```

---

## Task 7: Frontend — tenants management page

**Files:**
- Create: `apps/admin/src/app/(super-admin)/tenants/page.tsx`

- [ ] **Step 1: Create tenants page**

A 'use client' page with:
- Table: name, business_type, plan, status (badge), email, created_at, actions
- Status badges: active=green, pending=yellow, suspended=red, cancelled=gray
- Actions: Suspend button (if active), Activate button (if suspended/pending), "Entrar" button (switch tenant)
- Business type labels (use BUSINESS_TYPES constant for display)
- Use `getTenants()` with `useQuery`
- Suspend/activate use `useMutation` with invalidation

"Entrar" button (switch tenant) should:
1. Store the tenant slug in `localStorage.setItem('tenant_slug', slug)`
2. Store `localStorage.setItem('super_admin_mode', 'true')` to show the return banner
3. Navigate to `/dashboard`

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(super-admin)/tenants/page.tsx
git commit -m "feat: create super admin tenants management page"
```

---

## Task 8: Frontend — users page

**Files:**
- Create: `apps/admin/src/app/(super-admin)/users/page.tsx`

- [ ] **Step 1: Create users page**

A 'use client' page with:
- Table: name, email, tenant(s) (comma-separated names), role, super_admin badge, created_at
- Read-only (no actions for now)
- Use `getUsers()` from super-admin API
- Super admin users get a purple "Super Admin" badge

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(super-admin)/users/page.tsx
git commit -m "feat: create super admin users page"
```

---

## Task 9: Frontend — switch tenant banner

**Files:**
- Modify: `apps/admin/src/app/(tenant)/layout.tsx`

- [ ] **Step 1: Add super admin banner**

When `localStorage.getItem('super_admin_mode') === 'true'`, show a fixed banner at the top of the tenant layout:

- Yellow/orange background
- Text: "Viendo: [tenant_slug]" (from localStorage)
- "Volver al panel" button that:
  1. Removes `tenant_slug` from localStorage
  2. Removes `super_admin_mode` from localStorage
  3. Navigates to `/super-admin`

The banner should be above the TopBar, fixed position.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(tenant)/layout.tsx
git commit -m "feat: add super admin switch-tenant banner in tenant layout"
```

---

## Task 10: Backend — seed super admin user + verification

- [ ] **Step 1: Seed super admin**

Run the seeder to create the super admin user (if not exists):

```bash
cd apps/backend && php artisan db:seed --class=UserSeeder
```

If seeder fails (duplicate data), just manually create the super admin:

```bash
php artisan tinker --execute="App\Infrastructure\Persistence\Models\UserModel::firstOrCreate(['email' => 'super@turnly.com'], ['name' => 'Super Admin', 'password' => bcrypt('password'), 'is_super_admin' => true]);"
```

- [ ] **Step 2: Run tests**

```bash
php artisan test
```

- [ ] **Step 3: Build admin**

```bash
cd apps/admin && npm run build
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: verification fixes for Plan 5"
```
