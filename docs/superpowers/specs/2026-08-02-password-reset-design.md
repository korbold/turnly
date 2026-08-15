# Password Reset (forgot-password) — Design

**Date:** 2026-08-02
**Status:** Approved, pending implementation
**Scope:** Backend (Laravel) + admin frontend (Next.js)

## Problem

`goturnly.com/forgot-password` renders "Negocio no encontrado" because **the route does not exist** — the login page links to `/forgot-password` but no page was ever created, so the URL falls through to the dynamic tenant route `(public)/[slug]`, which does `getTenantBySlug("forgot-password")`, fails, and shows the tenant-not-found screen. There is also **no backend password-reset flow** (no route/controller/broker; the `password_reset_tokens` table is scaffolded but unused). The existing magic-link is customer-mobile-only (`/m/[token]` is an app deeplink launcher, "sólo funciona en tu celular") — not usable for admin web recovery.

## Goal

A self-service, web-native password reset for email-bearing owners/admins: type email → validate the business is registered → email a reset **link** → click → set a new password.

## Decisions (locked)

- **Link-based reset** (token in an emailed link), not a 6-digit code.
- **Validate + tell**: if the email is not registered, the forgot page shows "No encontramos un negocio con ese correo." (The user chose UX over anti-enumeration. Tradeoff noted: this lets an attacker probe which emails are registered. Rate-limiting mitigates but does not eliminate it.)
- **Link expiry: 1 hour.**
- Reuse the existing (empty) `password_reset_tokens` table. Store a **hash** of the token, not the raw token.
- Only users with an email AND at least one tenant membership qualify (username-only staff have no email → still reset by an admin via the existing `users/{id}/password`, unchanged).

## Architecture

### Backend

**Routes** (`routes/api.php`, in the `v1` prefix, OUTSIDE `auth:sanctum` — public, throttled):
```
POST auth/password/forgot   → AuthController@forgotPassword   (throttle)
POST auth/password/reset    → AuthController@resetPassword    (throttle)
```
(Add to `AuthController`, or a small `PasswordResetController` — implementer's call; keep it near the other auth methods.)

**`forgotPassword(Request)`** — body `{ email }`:
- Validate `email` is a well-formed email.
- Find `UserModel` by `email`. Qualify = user exists AND has ≥1 active `tenant_users` row.
- **Not qualified** → `404 { error: { code: 'BUSINESS_NOT_FOUND', message: 'No encontramos un negocio con ese correo.' } }`.
- **Qualified** → generate `raw = Str::random(64)`; upsert `password_reset_tokens` (`email` PK, `token = hash('sha256', raw)`, `created_at = now()`) — one live token per email (overwrites any prior). Send `PasswordResetMail` to the email with link `{frontendUrl}/reset-password?token={raw}&email={urlencoded email}`. Return `200 { data: { sent: true } }`.
- The frontend base URL comes from config the way `MagicLinkController::buildMagicUrl` derives its host (reuse the same config key / helper). Do NOT hardcode the domain.

**`resetPassword(Request)`** — body `{ email, token, password }`:
- Validate: `email` email; `token` string; `password` `required|string|min:6` (match `UserController::resetPassword`'s rule; consider `confirmed` if the frontend sends `password_confirmation`).
- Look up `password_reset_tokens` by `email`. Reject (`422 { code: 'INVALID_RESET_TOKEN' }`) if: no row, `hash('sha256', token) !== row.token`, or `created_at` older than 60 min.
- On success: `UserModel::where('email',$email)->first()`; `forceFill`/set `password = Hash::make($password)`; save; `$user->tokens()->delete()` (invalidate sessions); delete the `password_reset_tokens` row (single-use). Return `200 { data: { message: 'Contraseña actualizada.' } }`.

**Mailable `PasswordResetMail`** — mirror `VerificationCodeMail` (`app/Infrastructure/Mail/`): constructor `(UserModel $user, string $resetUrl, int $ttlMinutes)`, subject "Restablece tu contraseña de Turnly", view `emails.password-reset` (new Blade in `resources/views/emails/`) rendering `name`, `resetUrl`, `ttlMinutes`. Uses the existing Resend mailer + queue (`ShouldQueue` like the others). A queue worker must be running (it is — `turnly-queue`).

**Token table:** `password_reset_tokens` already exists (`email` PK string, `token` string, `created_at` nullable) — no migration needed.

### Frontend

**API layer** (mirror `resendVerification` across the 4 layers):
- `auth.repository.ts` interface: `requestPasswordReset(email: string): Promise<void>` and `resetPassword(input: { email: string; token: string; password: string }): Promise<void>`.
- `api-auth.repository.ts`: `await api.post('/auth/password/forgot', { email })` and `await api.post('/auth/password/reset', { email, token, password })`. (baseURL already includes `/api/v1`.)
- Use-cases: `RequestPasswordResetUseCase`, `ResetPasswordUseCase`.
- Hooks (`use-auth.ts`): `useRequestPasswordReset()`, `useResetPassword()` (react-query mutations, mirror `useResendVerification`).

**`/forgot-password` page** — create BOTH `src/app/(auth)/forgot-password/page.tsx` (thin re-export) and `src/presentation/app/(auth)/forgot-password/page.tsx` (impl). Clone the `login` page structure ('use client', react-hook-form + zod single `email` field, `Input`/`Button`/`Label`, sonner toast, the same card wrapper; inherits the `(auth)` layout automatically). Flow: submit → `useRequestPasswordReset`. `onSuccess` → swap form for a confirmation card "Te enviamos un enlace a {email} para restablecer tu contraseña." `onError` with `code === 'BUSINESS_NOT_FOUND'` (or 404) → inline error "No encontramos un negocio con ese correo." Link back to `/login`.

**`/reset-password` page** — create both app-tree files. Reads `token` and `email` from query params (`useSearchParams`). Form: new `password` + `password_confirmation` (zod: min 6, match). Submit → `useResetPassword({ email, token, password })`. `onSuccess` → toast "Contraseña actualizada" + redirect `/login`. `onError` (invalid/expired token) → message "El enlace no es válido o expiró. Solicita uno nuevo." with a link to `/forgot-password`. If `token`/`email` missing from the URL → show the invalid-link state immediately.

The login page's existing `href="/forgot-password"` link now resolves to the real page — no change needed there.

## Data flow

```
/forgot-password: email → POST auth/password/forgot
   found + has tenant → store sha256(token) in password_reset_tokens, email link
       {frontend}/reset-password?token=RAW&email=E ; return sent
   not found → 404 BUSINESS_NOT_FOUND → "No encontramos un negocio con ese correo."
click emailed link → /reset-password?token&email → new password
   → POST auth/password/reset {email, token, password}
       valid + ≤60min → set password, delete token, revoke sessions → login
       invalid/expired → "El enlace no es válido o expiró."
```

## Error handling / edge cases

- Unregistered email → 404 `BUSINESS_NOT_FOUND` (per the locked UX decision).
- Expired (>60 min) / wrong / already-used token → `422 INVALID_RESET_TOKEN`.
- Requesting a new link overwrites the prior token (single live token per email).
- Reset revokes all Sanctum tokens so old sessions can't continue.
- Username-only staff (no email) can't use this — unchanged; admin resets them.
- Throttle both endpoints (reuse an existing `throttle:` limiter like the magic-link ones) to blunt enumeration/abuse.

## Testing (backend Pest)

- `forgot` with a registered owner email → 200, a `password_reset_tokens` row exists for that email, mail queued (`Mail::fake` + `assertQueued(PasswordResetMail)`).
- `forgot` with an unregistered email → 404 `BUSINESS_NOT_FOUND`, no token row, no mail.
- `reset` with a valid fresh token → 200, `Hash::check(new, user.password)` true, token row deleted, user's tokens revoked.
- `reset` with an expired token (created_at 61 min ago) → 422 `INVALID_RESET_TOKEN`, password unchanged.
- `reset` with a wrong token → 422.
- Full round-trip: forgot → read the stored token (in test, generate/insert a known token or capture from the mailable) → reset → login with the new password succeeds.

Frontend: admin-v2 has no JS test runner → `tsc --noEmit` + the backend tests. Manual: forgot with a real owner email on dev, click the emailed link, set a new password, log in.

## Files

**Backend — new:**
- `app/Infrastructure/Mail/PasswordResetMail.php`
- `resources/views/emails/password-reset.blade.php`
- Pest test `tests/Feature/Auth/PasswordResetTest.php`

**Backend — edit:**
- `routes/api.php` (2 public routes)
- `app/Infrastructure/Http/Controllers/Auth/AuthController.php` (`forgotPassword`, `resetPassword`) — or a new `PasswordResetController`

**Frontend — new:**
- `src/app/(auth)/forgot-password/page.tsx` + `src/presentation/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx` + `src/presentation/app/(auth)/reset-password/page.tsx`
- `src/application/use-cases/auth/request-password-reset.use-case.ts`, `reset-password.use-case.ts`

**Frontend — edit:**
- `src/domain/repositories/auth.repository.ts`, `src/infrastructure/api/repositories/api-auth.repository.ts`, `src/presentation/hooks/use-auth.ts`

## Reference

Mirror `EmailVerificationService`/`VerificationCodeMail` for the mailable + Resend/queue pattern; `MagicLinkController::buildMagicUrl` for the frontend-host config; `resendVerification` (repo/use-case/hook) for the frontend API-layer pattern; the `login`/`verify-email` pages for the form/toast/layout pattern. Related: [[turnly_username_staff_email_verify]] (username-only staff have no email — out of scope here).
