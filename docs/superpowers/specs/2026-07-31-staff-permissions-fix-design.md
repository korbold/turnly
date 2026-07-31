# Staff Permissions Fix — Design

**Date:** 2026-07-31
**Status:** Approved, pending implementation
**Scope:** Backend (Laravel) + admin frontend (Next.js)

## Problem (root cause, confirmed end-to-end)

A newly created cashier/washer (`cajero`/`lavador`) staff member logs in and sees an **empty app** — no sidebar items, no way to navigate — so it looks like "another/empty business". Confirmed on prod: the tenant `Negocio de pruebas` has real data (14 reservations, 6 products, 2 clients) and the staff user `danny` has exactly one correct membership (cashier, that tenant). The emptiness is **not** a tenant-resolution bug; it is the permissions system being broken end-to-end:

1. **Enforcement (frontend):** `apps/admin-v2/src/presentation/hooks/use-permissions.ts:55` resolves each restricted-role section as `settings?.permissions?.[matrixKey]?.[section] ?? 'none'`. For `owner`/`tenant_admin` it early-returns `true` (lines 40-41), so they're unaffected. For `cashier`/`washer`, when `settings.permissions` is missing the role/section, **every** section resolves to `'none'` → `canAccess` returns `false` everywhere → `sidebar.tsx:171,185` and `bottom-tabs.tsx:71` filter out **all** nav items → empty app.

2. **Persist (backend) is a no-op:** the "Permisos" tab (`permissions-tab.tsx`) PATCHes `/tenant/settings` with a **top-level** `permissions` matrix (`api-tenant.repository.ts:35,46`). But `TenantSettingsController::update` has **no** handling for `permissions` — not in validation, not in `$request->only()`, not in the settings-merge block. It silently drops it and returns 200 + "Permisos guardados" (a false success).

3. **Read (backend) omits it:** `TenantResource::toArray` never emits a `permissions` key, so `tenant.mapper.ts:61` always yields `settings.permissions = {}` client-side — for **every** tenant, regardless of what an owner tries to save.

4. **No default/seed:** `RegisterTenantUseCase.php:43` creates tenants with `settings: null`. No default permissions matrix anywhere.

Net: no tenant can ever have a working cashier/washer permission set; every cashier/washer is locked out; the owner cannot fix it because saving is a no-op. The section/role key names DO match between the editor UI and the enforcement hook (no naming mismatch) — the break is purely the missing round-trip plus the missing default.

## Decisions (locked)

- **Default for unconfigured restricted roles: a sensible per-role baseline** (not all-`none`, not all-`view`). A freshly created cashier/washer works out of the box; the owner can still customize via the (now-working) Permisos tab.
- **Fix the round-trip** so the Permisos tab actually persists and reflects saved permissions.
- **Frontend default** (not a backend seed migration) so **existing** tenants (whose `settings` has no `permissions`) are fixed immediately with no data migration.

## Out of scope (documented follow-ups, not this change)

- **Backend per-section enforcement.** Today permissions are frontend nav-filtering only; there is no route guard, so a cashier could in principle URL-navigate to a hidden page. Fixing the reported "empty app" symptom does not require backend enforcement. Hardening it (a policy/middleware mapping each route to a section+permission) is a separate feature.
- **`ResolveTenantMiddleware` membership check** (the separate cross-tenant `X-Tenant` trust gap). This must NOT be added to the shared `ResolveTenantMiddleware` — that would break first-time customers who legitimately hit the `tenant`-middleware customer-booking routes (`client-resources`, `available-slots`) for a tenant they have no `tenant_users` row for yet. The safe design is a NEW `tenant.member` middleware applied ONLY to the staff group (`verified.email` + `tenant`, api.php:139-291), with super-admin impersonation passing naturally (it issues a token for a real tenant member). Tracked as a fast-follow.
- **Login arbitrary-tenant `->first()`** (`AuthController::login`) for multi-tenant users. Latent; not triggering for current single-membership users. Needs a "default tenant"/switcher UX decision. Deferred.

## The default permissions baseline

A single shared constant is the source of truth for both the enforcement fallback and the editor's initial grid, so they never drift.

| Role \ Section | Dashboard | Reservas | Registro | Clientes | Servicios | Equipo | Reportes | Config |
|---|---|---|---|---|---|---|---|---|
| **Admin** | full | full | full | full | full | full | full | full |
| **Cajero** | view | full | full | full | view | none | none | none |
| **Lavador** | view | view | full | none | none | none | none | none |
| **Cliente** | none | none | none | none | none | none | none | none |

Rationale: a cashier runs the front desk (bookings, walk-in service logs + cobrar, clients; sees the service catalog) but not team/reports/config. A washer logs the services they perform and sees their queue. Admin is full (also short-circuited to `true` in the hook). Client never enters the admin panel. `view` vs `full` is not yet separately enforced (both grant nav access today) but is set correctly for when finer enforcement lands.

## Architecture

### 1. Backend — persist `permissions` (round-trip in)

`apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php::update`:
- Add a validation rule: `'permissions' => 'sometimes|array'`.
- In the settings-JSON merge block, add: `if ($request->has('permissions')) { $settings['permissions'] = $request->input('permissions'); }` so it's stored under the `settings` JSON `permissions` key (co-located with `iva_mode` etc.).

### 2. Backend — return `permissions` (round-trip out)

`apps/backend/app/Infrastructure/Http/Resources/TenantResource.php::toArray`:
- Add `'permissions' => $settings['permissions'] ?? (object)[]` (reading from the decoded `settings` JSON, mirroring how other settings-derived keys are surfaced). Empty object when absent so the frontend mapper reads `{}` and falls back to the baseline.

### 3. Frontend — shared default baseline + fallback in the resolver

- New shared constant `DEFAULT_PERMISSIONS` (the table above) in a small module under `apps/admin-v2/src/shared/` (e.g. `shared/constants/permissions.ts`), typed as `Record<RoleKey, Record<SectionKey, 'full'|'view'|'none'>>`.
- `use-permissions.ts`: change the resolution to
  `const permission = settings?.permissions?.[matrixKey]?.[section] ?? DEFAULT_PERMISSIONS[matrixKey]?.[section] ?? 'none';`
  So explicit saved config wins; absent → baseline; unknown → `none`. Owner/admin/client branches unchanged.
- `permissions-tab.tsx`: `buildDefaultMatrix()` currently seeds every non-Admin cell to `'none'`. Change it to seed from `DEFAULT_PERMISSIONS` (same shared constant) so the editor's initial grid (shown before/without saved data) reflects the real defaults, and saving from a fresh grid preserves the sensible baseline rather than locking everyone to `none`.

### Data flow (after fix)

```
Owner opens Permisos tab
  → grid initialized from DEFAULT_PERMISSIONS (shared)  [or from saved matrix once persisted]
  → toggles a cell → autoSave → PATCH /tenant/settings { permissions: matrix }
      → TenantSettingsController persists settings.permissions      [FIX 1]
  → GET /tenant/settings → TenantResource returns permissions       [FIX 2]
      → tenant.mapper → settings.permissions populated

Cashier logs in
  → use-permissions.canAccess(href)
      → settings.permissions[Cajero][section]  (if owner configured)
        ?? DEFAULT_PERMISSIONS[Cajero][section]  (baseline)          [FIX 3]
        ?? 'none'
  → sidebar shows the allowed items → app is usable
```

## Error handling / edge cases

- `settings.permissions` present but missing a role or a section key → falls back to `DEFAULT_PERMISSIONS`, then `none`. No crash (optional chaining throughout).
- Owner explicitly sets a cashier section to `none` and saves → persisted matrix has that cell `none` → default not consulted → access correctly denied.
- Existing tenants with `settings` lacking `permissions` → immediately get the baseline (no migration needed).
- `owner`/`tenant_admin` unaffected (early `return true`); `client` still always denied.

## Testing

**Backend (Pest, `tests/Feature/`):**
- PATCH `/tenant/settings` with a `permissions` matrix persists it: re-GET returns the same matrix (round-trip). (Fails today — permissions dropped.)
- PATCH `/tenant/settings` with `permissions` does not clobber other settings keys (e.g. `iva_mode` preserved).
- `TenantResource` includes a `permissions` key (empty object when unset).

**Frontend (`use-permissions` unit test if a test setup exists; otherwise a typed unit of the resolver):**
- Cashier with `settings.permissions = {}` → `canAccess('/reservations')` true (baseline), `canAccess('/settings')` false, `canAccess('/inventory')` false (section undefined).
- Washer baseline: `canAccess('/service-logs')` true, `canAccess('/clients')` false.
- Explicit saved `none` for cashier Reservas overrides baseline → `canAccess('/reservations')` false.
- Owner → always true; client → always false.
- `buildDefaultMatrix()` returns the baseline (Cajero.Reservas === 'full', Lavador.Clientes === 'none').

(If admin-v2 has no JS test runner wired, cover the resolver logic by extracting it to a pure function and asserting via a lightweight test or, at minimum, `tsc` + the backend round-trip tests; note which in the plan.)

## Files

**Backend — edit:**
- `app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php` (persist `permissions`)
- `app/Infrastructure/Http/Resources/TenantResource.php` (return `permissions`)

**Frontend — new + edit:**
- `src/shared/constants/permissions.ts` (new — `DEFAULT_PERMISSIONS`)
- `src/presentation/hooks/use-permissions.ts` (baseline fallback)
- `src/presentation/components/features/settings/permissions-tab.tsx` (`buildDefaultMatrix` from shared constant)

## Reference

Enforcement hook `use-permissions.ts`, editor `permissions-tab.tsx`, settings controller `TenantSettingsController.php`, resource `TenantResource.php`. Key/role names already consistent (`Admin/Cajero/Lavador/Cliente` × `Dashboard/Reservas/Registro/Clientes/Servicios/Equipo/Reportes/Config`).
