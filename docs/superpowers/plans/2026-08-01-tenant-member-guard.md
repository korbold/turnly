# Tenant Membership Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the cross-tenant `X-Tenant` IDOR by rejecting (403) any authenticated non-super-admin user who is not an active member of the resolved tenant, on staff routes only.

**Architecture:** A new `tenant.member` middleware runs after `tenant` on the staff route group (excluding `auth/me`, which the customer app calls before booking). It checks an active `tenant_users` row via `$user->tenants()->where('tenants.id',$tid)->wherePivot('is_active',true)->exists()`, with a super-admin bypass. Existing feature tests that exercised the (previously unguarded) impossible state of a non-member hitting staff routes are repaired with real membership rows.

**Tech Stack:** Laravel (PHP, strict_types where the neighbor uses it), Pest (SQLite in-memory).

## Global Constraints

- Middleware namespace `App\Infrastructure\Http\Middleware`; mirror `EnsureEmailVerifiedMiddleware` style (`declare(strict_types=1);`, `JsonResponse`, `error.code`/`error.message` 403 envelope).
- Membership check MUST filter `is_active = true` (block deactivated members). Super-admin (`is_super_admin`) bypasses. When no tenant is bound (`! app()->has('current_tenant_id')`), pass through (do not 403).
- Guard goes ONLY on the staff group. It must NOT be added to: `ResolveTenantMiddleware`, the customer-booking group (`api.php:112`, `client-resources*` + `reservations/available-slots`), the device-tokens group (`api.php:102`), or `GET auth/me`.
- `auth/me` must remain reachable by non-members — split it into its own `['verified.email','tenant']` group with NO `tenant.member`.
- Feature tests in `tests/Feature/` auto-apply `RefreshDatabase`; no `uses()`. Tenant rows via `TenantUserModel::create([...])`.
- Baseline failing set (unrelated pre-existing failures to PRESERVE, not fix): `ClientResourceTest` (5), `ReservationInvoiceTest` (3), `ServiceLogTest` (1) = 9 total. After this change the suite's failing set must equal exactly these 9, and `TenantMemberGuardTest` must pass.
- Run tests from `apps/backend/`: `./vendor/bin/pest <path>`; full suite `./vendor/bin/pest`.

---

### Task 1: `tenant.member` middleware + alias + route split + guard tests

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Middleware/EnsureTenantMemberMiddleware.php`
- Modify: `apps/backend/bootstrap/app.php` (alias block)
- Modify: `apps/backend/routes/api.php` (split `auth/me` out; add `tenant.member` to the staff group)
- Test: `apps/backend/tests/Feature/Tenant/TenantMemberGuardTest.php`

**Interfaces:**
- Produces: middleware alias `tenant.member`. On guarded routes: 403 `{error:{code:'TENANT_FORBIDDEN'}}` for non-members/deactivated; pass for active members and super-admins.

**Note:** This task's route change will make several EXISTING feature tests 403 (they act as non-members on staff routes). That breakage is EXPECTED and is repaired in Task 2. This task verifies only its own `TenantMemberGuardTest` (green) plus the guard diff; do NOT attempt to fix other tests here.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Tenant/TenantMemberGuardTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function guardTenant(): TenantModel
{
    $t = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $t);
    app()->instance('current_tenant_id', $t->id);
    return $t;
}

function memberRow(string $tenantId, string $userId, string $role = 'owner', bool $active = true): void
{
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenantId,
        'user_id'   => $userId,
        'role'      => $role,
        'is_active' => $active,
    ]);
}

test('active member can access a guarded staff route', function () {
    $t = guardTenant();
    $owner = UserModel::factory()->create();
    memberRow($t->id, $owner->id, 'owner', true);

    $this->actingAs($owner)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('non-member is blocked from a guarded staff route', function () {
    $t = guardTenant();
    $stranger = UserModel::factory()->create();

    $this->actingAs($stranger)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});

test('deactivated member is blocked from a guarded staff route', function () {
    $t = guardTenant();
    $user = UserModel::factory()->create();
    memberRow($t->id, $user->id, 'cashier', false);

    $this->actingAs($user)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});

test('super admin passes the guard without a membership row', function () {
    $t = guardTenant();
    $admin = UserModel::factory()->superAdmin()->create();

    $this->actingAs($admin)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('auth/me is NOT guarded so a non-member still gets a response', function () {
    $t = guardTenant();
    $stranger = UserModel::factory()->create();

    $this->actingAs($stranger)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.tenant', null);
});

test('cross-tenant access is blocked: a member of A cannot use B', function () {
    $tenantA = TenantModel::factory()->create(['status' => 'active']);
    $tenantB = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    memberRow($tenantA->id, $user->id, 'owner', true);

    app()->instance('current_tenant', $tenantB);
    app()->instance('current_tenant_id', $tenantB->id);

    $this->actingAs($user)->withHeader('X-Tenant', $tenantB->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Tenant/TenantMemberGuardTest.php`
Expected: FAIL — the non-member/deactivated/cross-tenant cases currently return 200 (no guard yet); `auth/me` case may pass already.

- [ ] **Step 3: Create the middleware**

Create `apps/backend/app/Infrastructure/Http/Middleware/EnsureTenantMemberMiddleware.php`:

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

        // Super-admins operate across tenants.
        if ($user && $user->is_super_admin) {
            return $next($request);
        }

        // No tenant resolved (no slug) — nothing to guard here.
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
                    'code'    => 'TENANT_FORBIDDEN',
                    'message' => 'No tienes acceso a este negocio.',
                ],
            ], 403);
        }

        return $next($request);
    }
}
```

- [ ] **Step 4: Register the alias**

In `apps/backend/bootstrap/app.php`, inside the `$middleware->alias([...])` block (after the `'verified.email'` line), add:
```php
            'tenant.member' => \App\Infrastructure\Http\Middleware\EnsureTenantMemberMiddleware::class,
```

- [ ] **Step 5: Split `auth/me` out and guard the rest**

In `apps/backend/routes/api.php`, the staff group currently is `Route::middleware(['verified.email', 'tenant'])->group(function () {` (line ~139) containing `auth/me` (line ~141) followed by all staff routes through availability-blocks (~line 290).

Make two changes:
(a) Pull `auth/me` into its OWN group, placed immediately before the staff group, keeping the same middleware (NO `tenant.member`):
```php
        // auth/me stays unguarded: the customer app calls it pre-booking,
        // and me() deliberately tolerates a non-member (returns tenant: null).
        Route::middleware(['verified.email', 'tenant'])->group(function () {
            Route::get('auth/me', [AuthController::class, 'me']);
        });
```
(b) Change the existing staff group's middleware array from `['verified.email', 'tenant']` to `['verified.email', 'tenant', 'tenant.member']`, and remove the `auth/me` line from inside it (it now lives in the group from (a)). Every other route in that group stays exactly where it is.

- [ ] **Step 6: Run the guard test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Tenant/TenantMemberGuardTest.php`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Middleware/EnsureTenantMemberMiddleware.php \
        apps/backend/bootstrap/app.php \
        apps/backend/routes/api.php \
        apps/backend/tests/Feature/Tenant/TenantMemberGuardTest.php
git commit -m "feat(security): tenant.member guard blocks cross-tenant access on staff routes"
```

---

### Task 2: Repair existing tests that acted as non-members on staff routes

**Files:**
- Modify: existing feature tests that now 403 on guarded routes (add an active owner `TenantUserModel` row for the acting user). Candidates from the blast-radius analysis: `LockedCustomFieldsTest`, `ReservationTest`, `CheckInBillingProfileTest`, `ProductControllerTest`, `ServiceVariantVehicleTypesTest`, `ServiceTest`, `ServiceLogInvoiceTest`, `BusinessResourceAutoAssignTest`, `BusinessResourceDataLayerTest`, and guarded-route cases in `ServiceLogTest` / `ReservationInvoiceTest`. Confirm the actual set by running the suite.

**Interfaces:**
- Consumes: the `tenant.member` guard from Task 1.

- [ ] **Step 1: Capture the guard-induced failures**

Run the full suite and capture the failing set:
`cd apps/backend && ./vendor/bin/pest 2>&1 | grep -E "FAILED|Tests:"`

The baseline (pre-existing, unrelated) failures are exactly: `ClientResourceTest` (5), `ReservationInvoiceTest` (3), `ServiceLogTest` (1) = 9. Any OTHER failing test, and any of those whose failure is now a **403** (rather than its original error), is guard-induced and in scope for repair. (`ClientResourceTest` hits the UNGUARDED customer-booking group, so its 5 failures are NOT guard-induced — leave them.)

- [ ] **Step 2: For each guard-induced 403, add an active owner membership row**

For every test file that now fails because its acting user is not a member, add — in the same setup where the tenant + acting user are created (a `beforeEach` if present, else inline per `test`) — an active owner row for that user:
```php
\App\Infrastructure\Persistence\Models\TenantUserModel::create([
    'id'        => (string) \Illuminate\Support\Str::uuid(),
    'tenant_id' => $tenant->id,
    'user_id'   => $user->id,
    'role'      => 'owner',
    'is_active' => true,
]);
```
Use the file's actual variable names for `$tenant` and the acting user. If a test acts as several distinct users against guarded routes, add a row for each. Add the `use` imports for `TenantUserModel` / `Str` if missing. Do NOT change any assertions or production code — only add membership setup.

- [ ] **Step 3: Re-run until the failing set equals the baseline**

Run: `cd apps/backend && ./vendor/bin/pest 2>&1 | grep -E "FAILED|Tests:"`
Iterate Step 2 until the ONLY remaining failures are the 9 baseline ones (`ClientResourceTest` 5, `ReservationInvoiceTest` 3, `ServiceLogTest` 1) and `TenantMemberGuardTest` passes. Do NOT touch the 9 baseline failures. If a baseline file (e.g. `ReservationInvoiceTest`, `ServiceLogTest`) has SOME cases that now 403, fix only those cases' membership (they return to their original pre-existing failure, which stays red) — never edit a case to mask its original unrelated failure.

- [ ] **Step 4: Confirm the diff is test-only**

Run: `git diff --stat` and confirm ONLY test files changed in this task (no production/route/middleware changes — those were Task 1). Quote the stat in the report.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/tests/
git commit -m "test(security): give tenant-scoped tests real membership rows for the tenant.member guard"
```

---

## Self-Review

**Spec coverage:**
- New `tenant.member` middleware (super-admin bypass, is_active filter, no-tenant passthrough, 403 TENANT_FORBIDDEN) → Task 1 Step 3. ✓
- Alias registration → Task 1 Step 4. ✓
- Route split (auth/me unguarded; rest guarded) → Task 1 Step 5. ✓
- Guard tests (member/non-member/deactivated/super-admin/me-excluded/cross-tenant) → Task 1 Step 1. ✓
- Existing-test repair to baseline → Task 2. ✓
- Not touched: ResolveTenantMiddleware, customer/device groups, me() logic, login → constraints + Task 1 Step 5 scope. ✓

**Placeholder scan:** Task 2's file list is "confirm by running the suite" with an exact repair recipe and a precise done-condition (failing set == the 9 baseline) — a run-and-diff procedure, not a placeholder.

**Type consistency:** middleware alias `tenant.member` used identically in Step 4 (register) and Step 5 (apply). 403 body `error.code = 'TENANT_FORBIDDEN'` asserted in Task 1 Step 1 matches the middleware in Step 3. Membership expression identical in middleware and in the spec.

## Notes for the implementer

- Middleware order in a group array is left-to-right inbound, so `['verified.email','tenant','tenant.member']` runs `tenant` (binds `current_tenant_id`) before `tenant.member` reads it.
- Impersonation is not a special case: `SuperAdminController::impersonate` issues a token for a real active tenant member, so it passes on membership alone.
- `UserModel::factory()->superAdmin()` sets `is_super_admin = true` (exists in `UserModelFactory`).
- Do not add `is_active` to `channels.php` or change other membership checks — out of scope.
