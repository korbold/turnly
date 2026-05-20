# Terms & Conditions Acceptance — Design Spec
**Date:** 2026-05-20
**App:** Turnly Customer (Flutter) + Backend (Laravel)
**Status:** Approved

---

## Problem

New users complete authentication (magic-link or Google Sign-in) without ever accepting the Terms & Conditions or Privacy Policy. No record of acceptance is stored server-side. This creates a legal gap and prevents re-prompting when terms are updated.

---

## Solution Overview

Option A: dedicated full-screen interstitial (`/accept-terms`) shown once after first login, enforced by router redirect and `AuthCubit` state. Acceptance recorded server-side with version tracking.

---

## Architecture

### Backend changes

**Migration:** add two columns to `users` table:
- `terms_accepted_at` — `TIMESTAMP NULL DEFAULT NULL`
- `terms_version_accepted` — `VARCHAR(10) NULL DEFAULT NULL`

**Auth responses updated** (`register`, `login`, `me`) to include:
```json
"terms_accepted_at": null | "2026-05-20T18:00:00Z",
"terms_version_accepted": null | "1.0"
```

**New endpoint:**
```
POST /auth/accept-terms
Authorization: Bearer <token>
Body: { "version": "1.0" }
Response 200: { "data": { "terms_accepted_at": "...", "terms_version_accepted": "1.0" } }
```

### Flutter new files

```
lib/features/terms/
  presentation/
    cubit/
      terms_acceptance_cubit.dart   — API call + state
      terms_acceptance_state.dart   — Idle / Loading / Success / Error
    screens/
      terms_acceptance_screen.dart  — full-screen UI
```

### Flutter modified files

- `lib/features/auth/domain/entities/user.dart` — add `termsAcceptedAt: DateTime?`
- `lib/features/auth/data/dtos/auth_dto.dart` — parse `terms_accepted_at`
- `lib/features/auth/presentation/cubit/auth_state.dart` — add `AuthTermsPending`
- `lib/features/auth/presentation/cubit/auth_cubit.dart` — emit `AuthTermsPending` when `termsAcceptedAt == null`
- `lib/features/auth/presentation/screens/login_screen.dart` — handle `AuthTermsPending` → navigate to `/accept-terms`
- `lib/core/storage/secure_storage.dart` — add `setTermsAccepted(bool)` + `getTermsAccepted()`
- `lib/app/router.dart` — redirect: `token != null && !termsAccepted` → `/accept-terms`; add `/accept-terms` route

---

## ConnectivityService / Router Redirect Logic

```dart
// In router redirect:
final token = await SecureStorage.getToken();
final termsAccepted = await SecureStorage.getTermsAccepted();
final isAuthenticated = token != null;

if (!isAuthenticated && !isAuthRoute) return '/login';
if (isAuthenticated && !termsAccepted && loc != '/accept-terms') return '/accept-terms';
if (isAuthenticated && isAuthRoute) return '/home';
return null;
```

`SecureStorage.getTermsAccepted()` returns `false` by default (key absent = not accepted).

After successful `POST /auth/accept-terms` → `SecureStorage.setTermsAccepted(true)` before navigating to `/home`.

---

## AuthCubit Change

After successful login/register/google-auth, inspect user:
```dart
if (user.termsAcceptedAt == null) {
  emit(AuthTermsPending());
} else {
  emit(AuthAuthenticated(user: user));
}
```

`AuthTermsPending` contains no sensitive data; the token is already stored in `SecureStorage` at this point.

---

## TermsAcceptanceCubit

```dart
sealed class TermsAcceptanceState {}
class TermsAcceptanceIdle extends TermsAcceptanceState {}
class TermsAcceptanceLoading extends TermsAcceptanceState {}
class TermsAcceptanceSuccess extends TermsAcceptanceState {}
class TermsAcceptanceError extends TermsAcceptanceState {
  final String message;
}
```

Single method: `accept()` → calls `POST /auth/accept-terms { version: "1.0" }` → on success: `SecureStorage.setTermsAccepted(true)` → emits `TermsAcceptanceSuccess`.

---

## Screen Design

### Visual spec

| Property | Value |
|---|---|
| Background | `AppColors.background` (`#FAFAFB`) |
| Surface cards | `AppColors.surface` (`#FFFFFF`) |
| Card border-radius | 12px |
| Card border | 1px `#E4E7EC` |
| Icon container | 72×72 circle, `#FDEEE6` bg, `Icons.verified_user_outlined` coral 32px |
| Title | "Antes de continuar", titleLarge w700, textPrimary, centered |
| Subtitle | bodyMedium, textSecondary, centered, max 260px width |
| List tiles | white card, chevron_right icon, textPrimary 14px w500 |
| Checkbox | coral (#F2693A) when checked, 44×44 touch target |
| CTA button | AppButton "Continuar", coral, full-width, disabled when unchecked (opacity 0.45) |

### Layout (full-screen, outside shell, SafeArea)

```
Column
├── SizedBox(height: screenHeight * 0.12)
├── Icon container (72×72, centered)
├── SizedBox(20)
├── Title (centered)
├── SizedBox(8)
├── Subtitle (centered, padded 40px horizontal)
├── SizedBox(32)
├── Card with 2 ListTiles (terms + privacy, each opens LegalScreen in modal)
├── SizedBox(24)
├── Row: Checkbox + label text (flexible, 44px touch area on checkbox)
├── Spacer()
├── AppButton "Continuar"
└── SizedBox(24)
```

---

## Animation Spec (Emil)

Frequency: once per user lifetime → crafted entry justified.

| Event | Animation | Duration | Curve |
|---|---|---|---|
| Screen entry | `translateY(100%) → translateY(0)` | 320ms | `Cubic(0.32, 0.72, 0, 1)` (iOS drawer) |
| Content stagger | `opacity 0→1` + `translateY(12→0)` per element | 280ms | `Curves.easeOut` |
| Stagger delay between elements | 40ms | — | icon → title → subtitle → card → checkbox row → button |
| Checkbox tap | `scale(0.9→1)` + color transition | 150ms | `Curves.easeOut` |
| Button press | `scale(0.97)` | 120ms | `Curves.easeOut` |
| Exit (accepted) | `opacity 1→0` + `translateY(0→-30)` | 200ms | `Curves.easeOut` |
| Reduced motion | opacity only, no translate | 150ms | linear |

Implementation: `flutter_animate` package (already in pubspec) for stagger. Use `MediaQuery.of(context).disableAnimations` for reduced motion check.

---

## States

| State | UI behavior |
|---|---|
| Default | Checkbox unchecked, CTA disabled (opacity 0.45, not tappable) |
| Checkbox checked | CTA enabled, full coral opacity |
| Loading | CTA shows CircularProgressIndicator (white, 18px), checkbox disabled |
| Error | Red inline message below CTA, CTA re-enabled, checkbox re-enabled |
| Success | Exit animation → `context.go('/home')` |

---

## LegalScreen Integration

Both "Términos y Condiciones" and "Política de Privacidad" list tiles open the existing `LegalScreen` as a modal bottom sheet (not a full push navigation, so user stays in the acceptance flow):

```dart
showModalBottomSheet(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
  ),
  builder: (_) => const LegalScreen(type: LegalType.terms),
);
```

---

## Copy

| Element | Text |
|---|---|
| Title | "Antes de continuar" |
| Subtitle | "Tómate un momento para revisar los términos antes de usar Turnly." |
| Terms tile | "Términos y Condiciones" + caption "Versión 1.0" |
| Privacy tile | "Política de Privacidad" + caption "Versión 1.0" |
| Checkbox label | "He leído y acepto los Términos y Condiciones y la Política de Privacidad" |
| CTA | "Continuar" |
| Error | "No se pudo registrar tu aceptación. Intenta de nuevo." |

---

## Accessibility

- `Semantics(liveRegion: true)` on error message
- Checkbox `semanticLabel: 'Acepto los Términos y Condiciones y Política de Privacidad'`
- CTA `semanticLabel` reflects disabled state: "Continuar, deshabilitado hasta aceptar los términos" when unchecked
- Color never the only indicator: checkbox uses check icon + color
- Minimum 44×44px touch targets on all interactive elements

---

## Version Tracking

`terms_version_accepted` stored alongside `terms_accepted_at`. When T&C version changes:
- Backend compares `users.terms_version_accepted` against current version
- Return `terms_accepted_at: null` in auth response to re-trigger the flow
- No client-side version logic needed: server controls re-prompt

---

## Constraints

- `flutter_animate` already in `pubspec.yaml` — no new package needed
- `LegalScreen` already exists — reused as modal sheet
- `SecureStorage` already exists — add two methods only
- Backend: single migration + single endpoint + response field additions
- No changes to existing routes' behavior; redirect is additive
