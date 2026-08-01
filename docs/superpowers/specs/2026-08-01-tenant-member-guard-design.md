# Tenant Membership Guard — Design

**Date:** 2026-08-01
**Status:** Approved, pending implementation
**Scope:** Backend (Laravel) only

## Problem (security)

`ResolveTenantMiddleware` resolves the current tenant purely from the `X-Tenant` header (frontend `localStorage['tenant_slug']`) and **never verifies the authenticated user belongs to that tenant**. Any logged-in, non-super-admin user can read/write ANY tenant's data by sending that tenant's slug in the header — a cross-tenant IDOR. `TenantScope` scopes queries by the resolved tenant, so a wrong header serves another business's data.

## Constraint that shapes the fix

A blanket membership reject **cannot** live in the shared `ResolveTenantMiddleware`, and cannot blanket the whole staff route group either:

- **Customer-booking group** (`routes/api.php:112-124`, `['tenant']` only: `client-resources*`, `reservations/available-slots`) is hit by logged-in customers for a tenant they have **no `tenant_users` row for yet** (the row is created only at `PublicController::book`). Guarding it breaks first-time customers.
- **Device-tokens group** (`api.php:102-105`) tolerates no-slug for the mobile apps.
- **`GET auth/me`** (`api.php:141`) lives inside the staff group but is called by the **customer Flutter app** with `X-Tenant` set (Dio `tenant_interceptor` attaches the saved slug to every request; the slug is saved the moment a customer taps "Reserve", before booking). `AuthController@me` deliberately tolerates a missing membership (returns `role => $tenantUser?->role`, `tenant => null`). A 403 here would force-log-out browsing-but-not-yet-booked customers (`auth_cubit.dart` maps any `getMe()` failure to `AuthUnauthenticated`).

Clients who have actually booked get a `tenant_users` row with role `client` (`PublicController::book:451-454`), so they **are** members and pass. A membership check only blocks users with **no active row** for the resolved tenant.

## Decisions (locked)

- **New dedicated `tenant.member` middleware**, applied ONLY to the staff routes — NOT to `ResolveTenantMiddleware`, NOT to the customer-booking or device groups.
- **Exclude `auth/me`** from the guard: split it into a sibling `['verified.email','tenant']` group (no `tenant.member`), preserving its non-member-tolerant contract.
- **Block deactivated members:** membership check requires an **active** pivot row — `$user->tenants()->where('tenants.id',$tid)->wherePivot('is_active', true)->exists()`. A removed/deactivated staff member (`is_active=false`) is denied. (Diverges from `channels.php`'s `exists()`-without-`is_active`; chosen deliberately for a security gate.)
- **Super-admin bypass:** `is_super_admin` users pass without a membership row (they operate cross-tenant from the super-admin console). Note: impersonation already issues a token for a *real* tenant member, so it passes on membership alone — the bypass is belt-and-suspenders for a super-admin's own session.

## Architecture

### New middleware `EnsureTenantMemberMiddleware`

`app/Infrastructure/Http/Middleware/EnsureTenantMemberMiddleware.php`, alias `tenant.member`. Runs AFTER `tenant` in the group array (left-to-right inbound), so `current_tenant_id` is bound.

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnsureTenantMemberMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        // Super-admins operate cross-tenant.
        if ($user && $user->is_super_admin) {
            return $next($request);
        }

        // No tenant resolved (no slug) — nothing to guard; let downstream decide.
        if (! app()->has('current_tenant_id')) {
            return $next($request);
        }

        $tenantId = app('current_tenant_id');

        $isMember = $user
            && $user->tenants()
                ->where('tenants.id', $tenantId)
                ->wherePivot('is_active', true)
                ->exists();

        if (! $isMember) {
            return new JsonResponse([
                'error' => [
                    'code' => 'TENANT_FORBIDDEN',
                    'message' => 'No tienes acceso a este negocio.',
                ],
            ], 403);
        }

        return $next($request);
    }
}
```

### Alias registration

`bootstrap/app.php` alias block — add:
```php
'tenant.member' => \App\Infrastructure\Http\Middleware\EnsureTenantMemberMiddleware::class,
```

### Route change (`routes/api.php`)

Split the current staff group (line 139, `['verified.email','tenant']`, routes 141-291) into two sibling groups:

1. **Unguarded** — `auth/me` only, unchanged middleware `['verified.email','tenant']`:
```php
Route::middleware(['verified.email', 'tenant'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
});
```
2. **Guarded** — everything else (tenant/settings … availability-blocks, lines 144-290), middleware `['verified.email', 'tenant', 'tenant.member']`.

No route paths change; only the `auth/me` line moves to its own group and the rest gain `tenant.member`.

## What is NOT touched

- `ResolveTenantMiddleware` — unchanged (still resolves + binds; still lets no-slug through).
- Customer-booking group (112-124), device-tokens group (102-105), public routes, `client/*` routes — unchanged (no guard added).
- `AuthController@me` logic — unchanged (still tolerates non-member).
- Login tenant selection (`->first()`) — separate deferred item, out of scope.

## Testing (Pest, `tests/Feature/`)

Use `GET /api/v1/tenant/settings` as the representative guarded route and `GET /api/v1/auth/me` as the excluded route. Setup mirrors existing tenant tests (`TenantModel::factory`, `UserModel::factory`, `TenantUserModel::create`, `app()->instance('current_tenant*')`, `actingAs` + `X-Tenant`).

1. **Member passes:** owner (active member) → `GET tenant/settings` → 200.
2. **Non-member blocked:** user with NO row for the tenant → `GET tenant/settings` with that tenant's `X-Tenant` → 403 `TENANT_FORBIDDEN`.
3. **Deactivated member blocked:** member row `is_active=false` → `GET tenant/settings` → 403.
4. **Super-admin passes without membership:** `UserModel::factory()->superAdmin()` (no row) → `GET tenant/settings` → 200 (not 403).
5. **`auth/me` still works for a non-member:** user with no row + `X-Tenant` set → `GET auth/me` → 200, `data.tenant` null (guard NOT applied to /me).
6. **Cross-tenant is blocked:** member of tenant A sends `X-Tenant` = tenant B (no row in B) → `GET tenant/settings` → 403 (the core exploit is closed).

Regression: run `tests/Feature/` broadly; confirm no existing tenant-scoped test breaks (existing tests set up a `TenantUserModel` owner row or use `app()->instance` — verify the guarded-route tests that rely only on `app()->instance('current_tenant')` without a membership row are updated or already create a row).

**Blast radius (measured):** ~19 feature files bind `current_tenant` via `app()->instance` without a membership row, but only those that make an **HTTP call to a GUARDED route** with a non-member acting user break. Domain-only tests (StockLedger, ConsumptionEngine, LowStockCrossing — call `app(StockLedger::class)` directly, no HTTP) are unaffected: the middleware never runs. Tests hitting UNGUARDED routes are also safe: `client-resources*` and `reservations/available-slots` live in the customer-booking group (no guard), so `ClientResourceTest` and `AvailableSlotsByResourceTest` do not break.

The guarded-route HTTP tests with a non-member user that WILL now 403 and need an active owner `TenantUserModel::create(...)` row added: `LockedCustomFieldsTest`, `ReservationTest`, `CheckInBillingProfileTest`, `ProductControllerTest`, `ServiceVariantVehicleTypesTest`, `ServiceTest`, `ServiceLogInvoiceTest`, `BusinessResourceAutoAssignTest`, `BusinessResourceDataLayerTest`, and the guarded-route cases in `ServiceLogTest` / `ReservationInvoiceTest`. The guard exposes that these were testing an impossible state (a non-member accessing staff data).

**Baseline (pre-change) failing set to preserve** — the full suite currently has **9 pre-existing failures unrelated to this change**: `ClientResourceTest` (5), `ReservationInvoiceTest` (3), `ServiceLogTest` (1). After the guard + test repair, the suite's failing set must equal exactly this baseline (only these 9), plus the new `TenantMemberGuardTest` passing. Any test that newly fails with a 403 is guard-induced and must be fixed by adding the missing membership row — do NOT "fix" a pre-existing failure or mask it.

**Repair method (run-and-diff):** baseline the suite first; apply the guard; re-run; every NEW failure returning 403 `TENANT_FORBIDDEN` gets an active owner `TenantUserModel::create([...])` row for its acting user in that test's setup; re-run until the failing set equals the 9-file baseline.

## Files

**New:**
- `app/Infrastructure/Http/Middleware/EnsureTenantMemberMiddleware.php`

**Edit:**
- `bootstrap/app.php` (alias)
- `routes/api.php` (split `auth/me` out; add `tenant.member` to staff group)
- Existing feature tests that hit guarded routes without a membership row (add the owner row)

**Test:**
- `tests/Feature/Tenant/TenantMemberGuardTest.php`

## Reference

Mirrors `EnsureSuperAdminMiddleware` / `EnsureEmailVerifiedMiddleware` structure and the `error.code/message` 403 envelope. Membership expression mirrors `channels.php:6` plus an `is_active` filter. Closes the gap documented in `turnly_multitenant_security_debt` (memory). The login arbitrary-tenant `->first()` remains a separate deferred item.
