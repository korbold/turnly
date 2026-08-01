# Username Staff Email-Verification Fix — Design

**Date:** 2026-08-01
**Status:** Approved, pending implementation
**Scope:** Backend (Laravel) only

## Problem (root cause, confirmed on prod)

A staff member created by an admin/owner with a username + password (role cashier/washer, `email = null`) cannot use the app — every staff API call and `/auth/me` returns `403 EMAIL_NOT_VERIFIED`. On prod, `danny` (cashier) has `email_verified_at = null`.

`UserController::store()` (`POST users/invite`) *intends* to auto-verify staff — line 75 sets `'email_verified_at' => now()` in the `UserModel::create([...])` array with the comment "Staff accounts created by admins are trusted: skip email verification." **But `email_verified_at` is not in `UserModel::$fillable`, so Laravel's mass-assignment guard silently drops the key**, and the column (`email_verified_at timestamp nullable`, no default — migration `0001_01_01_000000`) falls back to `NULL`. So the staff user lands unverified.

`EnsureEmailVerifiedMiddleware` then blocks them: `if ($user && $user->email_verified_at === null) return 403 EMAIL_NOT_VERIFIED`. This middleware guards both the `auth/me` group and the whole staff group (`routes/api.php`). Login itself does not check verification (so login *succeeds*), but `/me` fails → frontend `useMe` errors → `me` is `undefined` → `usePermissions.canAccess` returns `true` for every href (full sidebar renders) while every data call 403s → the user sees a **full sidebar with empty data** = "empty business". This matches the reported symptom better than the (separately fixed) permissions bug.

Note: `MagicLinkController` and `GoogleAuthController` have the same dead `email_verified_at => now()` create-key, but both immediately follow with `$user->forceFill(['email_verified_at' => now()])->save()`, so they self-correct and are NOT affected. Only `UserController::store` lacks that follow-up. Out of scope: cleaning up the two harmless dead keys in MagicLink/Google.

## Decisions (locked)

- **Two complementary fixes** (a staff member may be created with OR without an email, and each variant needs a different guard):
  - **A — middleware:** `EnsureEmailVerifiedMiddleware` should only gate users who actually HAVE an email. A user with `email = null` has nothing to verify → pass. Fixes ALL existing email-less staff (including danny) with no migration.
  - **B — creation:** `UserController::store` must actually persist `email_verified_at` for the trusted admin-created staff account (covers staff created WITH an email, whom A does not skip).
- **B uses `forceFill(['email_verified_at' => now()])->save()`, NOT `$fillable`.** This matches the codebase convention (`EmailVerificationService`, `GoogleAuthController`, `MagicLinkController`, `ClaimService` all set `email_verified_at` via `forceFill`) and the deliberate security posture that keeps sensitive fields (`is_super_admin`, and now `email_verified_at`) out of `$fillable` so no mass-assign path can set them. Remove the dead `'email_verified_at' => now()` key from the `create([...])` array (it never worked).
- **No data migration / backfill.** Existing email-less staff (danny) are handled by A; existing email-bearing unverified staff, if any, are rare and can re-be-created or are covered when B runs on new creations. (If the team later wants danny's row marked verified for cleanliness, a one-off is trivial, but not required for function.)

## Why A is safe / correctly scoped

Only username-only staff have `email = null`. Walk-in/booking clients get a real or synthetic email (`PublicController::book` uses `$request->client_email`; `ClientResourceController::findOrCreateClient` uses a synthetic `…@client.local`), never null. Owners register with an email. So "`email === null` → skip verification" affects exclusively admin-created staff, who are trusted by design. A user with an email but unverified (owner mid-registration) keeps `email !== null` → still gated. Semantically airtight: no email ⇒ nothing to verify.

## Architecture

### A — `EnsureEmailVerifiedMiddleware`

`app/Infrastructure/Http/Middleware/EnsureEmailVerifiedMiddleware.php`, change the gate condition (line 16) from:
```php
if ($user && $user->email_verified_at === null) {
```
to:
```php
if ($user && $user->email !== null && $user->email_verified_at === null) {
```
Everything else unchanged (same 403 `EMAIL_NOT_VERIFIED` body).

### B — `UserController::store`

`app/Infrastructure/Http/Controllers/User/UserController.php`:
- Remove the dead `'email_verified_at' => now(),` line (and its comment) from the `UserModel::create([...])` array (~line 74-75).
- After the user is created (right after the `UserModel::create` assignment, before/after `TenantUserModel::create` is fine), persist the verified timestamp the way the rest of the codebase does:
```php
// Admin-created staff are trusted; mark verified (forceFill: email_verified_at
// is intentionally not fillable, matching is_super_admin's mass-assign guard).
$user->forceFill(['email_verified_at' => now()])->save();
```

## Data flow (after fix)

```
Admin invites a username cashier (no email)
  → UserController::store: create user (email null)
      → forceFill(email_verified_at = now())->save()   [B: persisted for good measure]
Staff logs in (login OK, no verify check)
  → GET /auth/me  → EnsureEmailVerifiedMiddleware:
        email === null  → skip (pass)                   [A]
        (or email set + verified now())                 [B]
     → tenant.member: active member → pass
     → /me returns role/tenant → app populated, data loads
```

## Error handling / edge cases

- Staff with email = null, verified = null (existing danny): A passes them. ✓
- Staff with email set, verified = null: B sets verified at creation; if somehow still null, A does NOT skip (email !== null) → 403 (correct — an email-bearing account that isn't verified stays gated; but B prevents this for admin-created staff). ✓
- Owner mid-registration (email set, unverified): still gated by A. ✓
- Walk-in/booking clients (synthetic/real email, unverified): still gated (they don't hit staff routes anyway). ✓
- `forceFill` bypasses `$fillable`, so no mass-assignment surface is opened. ✓

## Testing (Pest, `tests/Feature/`)

**Middleware (A)** — exercise via a `verified.email`-gated route. Use `GET /api/v1/tenant/settings` (behind `verified.email` + `tenant` + `tenant.member`); give the acting user an active owner membership so only the email-verify gate is under test:
1. **Email-less unverified user passes:** user with `email = null`, `email_verified_at = null`, active member → 200 (not 403 EMAIL_NOT_VERIFIED). (Fails today.)
2. **Email-bearing unverified user still blocked:** user with `email = 'x@y.com'`, `email_verified_at = null`, active member → 403 `EMAIL_NOT_VERIFIED`.
3. **Verified user passes:** `email_verified_at = now()`, active member → 200.

**Creation (B)** — via the invite endpoint:
4. Owner (verified, active member) `POST /api/v1/users/invite` with `{name, username, password, role: cashier}` (no email) → 201, and the created user row has `email_verified_at !== null`. (Fails today — silently dropped.)

Regression: run `tests/Feature/` broadly; the guard/permission suites must stay green (223+ passed / 9 baseline).

## Files

**Edit:**
- `app/Infrastructure/Http/Middleware/EnsureEmailVerifiedMiddleware.php` (A)
- `app/Infrastructure/Http/Controllers/User/UserController.php` (B)

**Test:**
- `tests/Feature/Auth/UsernameStaffEmailVerifyTest.php` (A + B)

## Reference

Middleware `EnsureEmailVerifiedMiddleware.php:16`; creation `UserController::store` (create at :67-76, missing `forceFill`); `$fillable` `UserModel.php:21-26` (note the `is_super_admin` security comment at :17-20 — same rationale for keeping `email_verified_at` out and using `forceFill`); `forceFill` precedent in `EmailVerificationService.php:65`, `MagicLinkController.php:117`, `GoogleAuthController.php:45`. Related shipped fixes: [[turnly_staff_permissions]], the tenant.member guard. This is the actual dominant blocker for username-only staff.
