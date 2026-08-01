# Username Staff Email-Verification Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let admin-created username-only staff (and email-bearing staff) actually use the app, by not gating email-less users on email verification and by persisting the trusted-staff verified timestamp.

**Architecture:** (A) `EnsureEmailVerifiedMiddleware` gates only users with a non-null email. (B) `UserController::store` persists `email_verified_at` via `forceFill` (the codebase convention; the field is intentionally not `$fillable`), removing the silently-dropped create-array key.

**Tech Stack:** Laravel, Pest (SQLite in-memory).

## Global Constraints

- Do NOT add `email_verified_at` to `UserModel::$fillable` — use `forceFill` (matches `is_super_admin`'s deliberate mass-assign guard and the `EmailVerificationService`/`MagicLink`/`Google`/`ClaimService` precedent).
- No data migration / backfill.
- Do NOT touch `MagicLinkController`/`GoogleAuthController` (their dead create-key is harmless — they forceFill right after).
- Feature tests in `tests/Feature/` auto-apply `RefreshDatabase` — no `uses()`. Tenant/user rows via factories + `TenantUserModel::create`.
- Run tests from `apps/backend/`: `./vendor/bin/pest <path>`; full suite baseline stays 9 pre-existing failures.

---

### Task 1: Skip email-less users in the verify gate + persist staff verification

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Middleware/EnsureEmailVerifiedMiddleware.php` (line 16)
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/User/UserController.php` (`store`, lines ~67-83)
- Test: `apps/backend/tests/Feature/Auth/UsernameStaffEmailVerifyTest.php`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Auth/UsernameStaffEmailVerifyTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function everifyTenant(): TenantModel
{
    $t = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $t);
    app()->instance('current_tenant_id', $t->id);
    return $t;
}

function everifyMember(string $tenantId, string $userId, string $role = 'owner'): void
{
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenantId,
        'user_id'   => $userId,
        'role'      => $role,
        'is_active' => true,
    ]);
}

test('email-less unverified staff can reach a verified.email-gated route', function () {
    $t = everifyTenant();
    $staff = UserModel::factory()->create(['email' => null, 'email_verified_at' => null]);
    everifyMember($t->id, $staff->id, 'owner');

    $this->actingAs($staff)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('email-bearing unverified user is still blocked by the verify gate', function () {
    $t = everifyTenant();
    $user = UserModel::factory()->create(['email' => 'pending@example.com', 'email_verified_at' => null]);
    everifyMember($t->id, $user->id, 'owner');

    $this->actingAs($user)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'EMAIL_NOT_VERIFIED');
});

test('verified user passes the gate', function () {
    $t = everifyTenant();
    $user = UserModel::factory()->create(['email' => 'ok@example.com', 'email_verified_at' => now()]);
    everifyMember($t->id, $user->id, 'owner');

    $this->actingAs($user)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('inviting a username-only staff member marks them verified', function () {
    $t = everifyTenant();
    $owner = UserModel::factory()->create(['email' => 'owner@example.com', 'email_verified_at' => now()]);
    everifyMember($t->id, $owner->id, 'owner');

    $this->actingAs($owner)->withHeader('X-Tenant', $t->slug)
        ->postJson('/api/v1/users/invite', [
            'name'     => 'Caja Uno',
            'username' => 'caja.uno',
            'password' => 'secret123',
            'role'     => 'cashier',
        ])
        ->assertStatus(201);

    $created = UserModel::where('username', 'caja.uno')->first();
    expect($created)->not->toBeNull();
    expect($created->email_verified_at)->not->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Auth/UsernameStaffEmailVerifyTest.php`
Expected: FAIL — test 1 returns 403 EMAIL_NOT_VERIFIED (email-less user gated today); test 4's created user has `email_verified_at === null` (dropped key). Tests 2 and 3 may already pass.

- [ ] **Step 3: Fix A — gate only email-bearing users**

In `apps/backend/app/Infrastructure/Http/Middleware/EnsureEmailVerifiedMiddleware.php`, change line 16 from:
```php
        if ($user && $user->email_verified_at === null) {
```
to:
```php
        if ($user && $user->email !== null && $user->email_verified_at === null) {
```

- [ ] **Step 4: Fix B — persist staff verification via forceFill**

In `apps/backend/app/Infrastructure/Http/Controllers/User/UserController.php` `store()`:

(a) Remove the dead key + comment from the `UserModel::create([...])` array — delete these two lines (currently ~74-75):
```php
            // Staff accounts created by admins are trusted: skip email verification.
            'email_verified_at' => now(),
```

(b) Immediately after the `UserModel::create([...]);` assignment (before the `TenantUserModel::create([...])` call, ~line 77), add:
```php
        // Admin-created staff are trusted; mark verified. forceFill because
        // email_verified_at is intentionally not fillable (mass-assign guard,
        // same rationale as is_super_admin).
        $user->forceFill(['email_verified_at' => now()])->save();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Auth/UsernameStaffEmailVerifyTest.php`
Expected: PASS (4 tests).

- [ ] **Step 6: Regression — auth + tenant + guard suites**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Auth/ tests/Feature/Tenant/`
Expected: PASS (no new failures; the tenant.member guard + settings tests still green).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Middleware/EnsureEmailVerifiedMiddleware.php \
        apps/backend/app/Infrastructure/Http/Controllers/User/UserController.php \
        apps/backend/tests/Feature/Auth/UsernameStaffEmailVerifyTest.php
git commit -m "fix(auth): username-only staff are not blocked by the email-verify gate"
```

---

## Self-Review

**Spec coverage:** A (middleware email-null skip) → Step 3; B (store forceFill + remove dead key) → Step 4; tests for email-less pass / email-bearing blocked / verified pass / invite marks verified → Step 1. No migration, no fillable change, MagicLink/Google untouched. ✓

**Placeholder scan:** all code literal; line references have exact before/after. ✓

**Type consistency:** middleware condition uses `$user->email` (nullable string) + `$user->email_verified_at` (datetime|null); forceFill key `email_verified_at` matches the cast. Test asserts `error.code` `EMAIL_NOT_VERIFIED` matching the middleware body. ✓

## Notes for the implementer

- The invite route `POST /api/v1/users/invite` is inside the guarded staff group, so the acting owner in test 4 must be a verified, active member (the test sets that up). If the invite response shape differs, assert on the DB row (`UserModel::where('username',...)`), which the test already does.
- `UserModel::factory()` default sets `email_verified_at => now()` and a real email; the tests override with explicit `email`/`email_verified_at` values, so factory defaults don't mask the cases.
