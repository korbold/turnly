# Google Sign-In for Customer App (Android)

**Date:** 2026-04-20
**Scope:** Flutter customer_v2 app + Laravel backend
**Platform:** Android only (for now)
**Google Cloud Project:** TURNLY (`turnly-493920`)

---

## Overview

Add native Google Sign-In to the customer Flutter app. Users tap "Continuar con Google", select their Google account, and the app sends the Google `idToken` to the backend for verification. Backend creates or finds the user and returns a Sanctum token. No Firebase dependency.

## Authentication Flow

```
Flutter (customer_v2)                    Laravel Backend
─────────────────────                    ──────────────
1. User taps "Continuar con Google"
2. google_sign_in package opens
   Google account picker
3. User selects Google account
4. Package returns GoogleSignInAccount
   with idToken

5. POST /api/v1/auth/google         →   6. Receive { id_token }
   { "id_token": "eyJ..." }             7. Verify idToken via
                                            Google_Client library
                                         8. Extract: email, name, picture
                                         9. Find user by email:
                                            - EXISTS → load user
                                            - NOT EXISTS → create user
                                              (name from Google, random password)
                                         10. Create Sanctum token
                                     ←   11. Return { user, token, tenant? }

12. Save token to SecureStorage
13. Emit AuthAuthenticated(user)
14. Router redirects to /home
```

## Backend Changes

### New Endpoint

**`POST /api/v1/auth/google`** (public, no auth required)

Request:
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

Response (same shape as existing login):
```json
{
  "data": {
    "user": { "id": "uuid", "name": "...", "email": "...", "is_super_admin": false },
    "token": "1|abc...",
    "tenant": null
  }
}
```

### Implementation Details

- **Package:** `google/apiclient` (composer) for server-side idToken verification
- **Verification:** Use `Google_Client::verifyIdToken($idToken)` which validates signature, expiry, and audience
- **User creation:** When email not found, create `UserModel` with:
  - `name`: from Google profile
  - `email`: from Google profile (verified by Google)
  - `password`: `Hash::make(Str::random(32))` (unusable for email/password login)
  - `phone`: null
- **Email collision:** If email already exists (registered via email/password), log them in. This links the account implicitly — same user, different auth method.
- **No tenant association:** Customer users don't belong to a tenant as owners. They book services at tenants. Tenant is null in response.

### New Files

| File | Purpose |
|------|---------|
| `app/Infrastructure/Http/Controllers/Auth/GoogleAuthController.php` | Handle Google sign-in endpoint |
| `app/Infrastructure/Http/Requests/Auth/GoogleLoginRequest.php` | Validate `id_token` field |

### Route Addition

```php
// routes/api.php — inside v1 prefix, public group
Route::post('auth/google', [GoogleAuthController::class, 'login']);
```

## Flutter Changes

### Package

Add to `pubspec.yaml`:
```yaml
google_sign_in: ^6.2.1
```

### Auth Repository

Extend `AuthRepository` interface:

```dart
// domain/repositories/auth_repository.dart
Future<Either<Failure, ({User user, String token})>> loginWithGoogle();
```

Implementation in `AuthRepositoryImpl`:
1. Call `GoogleSignIn().signIn()` to get account
2. Get `idToken` from `account.authentication`
3. POST `/auth/google` with `{ "id_token": idToken }`
4. Save token to SecureStorage
5. Return user

### Auth Cubit

New method:
```dart
Future<void> loginWithGoogle() async {
  emit(AuthLoading());
  final result = await _repository.loginWithGoogle();
  result.fold(
    (failure) => emit(AuthError(failure.message)),
    (data) => emit(AuthAuthenticated(data.user)),
  );
}
```

### UI Changes

**Login Screen** (`login_screen.dart`):
- Add "Continuar con Google" button below the login form
- Divider with "o" between form and Google button
- Google button uses standard Google branding (white bg, Google "G" icon, "Continuar con Google" text)

**Register Screen** (`register_screen.dart`):
- Same Google button at top, before the registration form
- Divider with "o" between Google button and form

### Error Handling

| Scenario | Behavior |
|----------|----------|
| User cancels Google picker | Silent — no error, no loading state |
| Google returns no idToken | Show "Error al iniciar con Google" toast |
| Backend verification fails | Show "Token de Google inválido" toast |
| Network error | Show "Error de conexión" toast |

## Google Cloud Console Setup (Manual)

Steps the developer must do in Google Cloud Console:

1. **OAuth consent screen** (APIs & Services > OAuth consent screen)
   - App name: Turnly
   - User support email: korbold@live.com
   - Scopes: `email`, `profile`, `openid`
   - Test users: add korbold@live.com (while in testing mode)

2. **Create OAuth Client ID** (APIs & Services > Credentials)
   - Type: Android
   - Package name: from `android/app/build.gradle` (`applicationId`)
   - SHA-1 fingerprint: from debug keystore
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
     ```

3. **Create Web Client ID** (needed for backend verification)
   - Type: Web application
   - No authorized origins/redirects needed (server-side verification only)
   - The `clientId` from this goes into backend config for audience validation

## Configuration

### Backend `.env`
```
GOOGLE_CLIENT_ID=<web-client-id-from-console>.apps.googleusercontent.com
```

### Flutter
No client ID config needed for Android — `google_sign_in` reads it from Google Services automatically via the Android OAuth client ID registered in Console.

## Security Considerations

- **idToken verified server-side** — never trust client-side claims
- **Audience check** — backend verifies token was issued for our app's client ID
- **No password exposure** — Google users get random unusable password
- **Token expiry** — Google idTokens expire in ~1 hour, but we only use them once for initial auth; Sanctum token is what persists
- **Email trust** — Google-verified emails are trustworthy; no email verification step needed

## Out of Scope

- iOS support (future)
- Apple Sign-In (future)
- Firebase integration
- Account linking UI (email user → add Google, or vice versa)
- Google profile picture sync
- Refresh token handling (Sanctum tokens don't expire by default)
