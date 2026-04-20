# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native Google Sign-In (Android) to customer_v2 Flutter app with server-side idToken verification in Laravel backend.

**Architecture:** Flutter uses `google_sign_in` package to get Google `idToken`, sends it to new `POST /api/v1/auth/google` endpoint, backend verifies with `google/apiclient`, creates/finds user, returns Sanctum token. Same auth flow as existing email/password.

**Tech Stack:** Flutter (`google_sign_in`), Laravel (`google/apiclient`), Google Cloud Console OAuth, PestPHP for backend tests.

**Spec:** `docs/superpowers/specs/2026-04-20-google-sign-in-customer-app-design.md`

---

## File Structure

### Backend (new files)
| File | Responsibility |
|------|---------------|
| `app/Infrastructure/Http/Controllers/Auth/GoogleAuthController.php` | Handle POST /auth/google, verify idToken, create/find user, return token |
| `app/Infrastructure/Http/Requests/Auth/GoogleLoginRequest.php` | Validate `id_token` field |
| `config/services.php` (modify) | Add `google.client_id` config |
| `routes/api.php` (modify) | Add `POST auth/google` route |
| `.env` (modify) | Add `GOOGLE_CLIENT_ID` |
| `tests/Feature/Auth/GoogleAuthTest.php` | Test Google auth endpoint |

### Flutter (new/modified files)
| File | Responsibility |
|------|---------------|
| `pubspec.yaml` (modify) | Add `google_sign_in` dependency |
| `lib/features/auth/domain/repositories/auth_repository.dart` (modify) | Add `loginWithGoogle()` method |
| `lib/features/auth/data/repositories/auth_repository_impl.dart` (modify) | Implement `loginWithGoogle()` |
| `lib/features/auth/presentation/cubit/auth_cubit.dart` (modify) | Add `loginWithGoogle()` method |
| `lib/features/auth/presentation/widgets/google_sign_in_button.dart` (create) | Reusable Google button widget |
| `lib/features/auth/presentation/screens/login_screen.dart` (modify) | Add Google button + divider |
| `lib/features/auth/presentation/screens/register_screen.dart` (modify) | Add Google button + divider |

---

## Task 1: Backend — Install google/apiclient and configure

**Files:**
- Modify: `apps/backend/composer.json`
- Modify: `apps/backend/.env`
- Modify: `apps/backend/config/services.php`

- [ ] **Step 1: Install google/apiclient**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/backend
composer require google/apiclient
```

- [ ] **Step 2: Add GOOGLE_CLIENT_ID to .env**

Add at the end of `.env`:

```
GOOGLE_CLIENT_ID=PLACEHOLDER_UNTIL_CONSOLE_SETUP
```

- [ ] **Step 3: Add google config to services.php**

Read `config/services.php` and add to the returned array:

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
],
```

- [ ] **Step 4: Commit**

```bash
git add composer.json composer.lock config/services.php .env.example
git commit -m "feat(backend): add google/apiclient and configure GOOGLE_CLIENT_ID"
```

Note: Commit `.env.example` not `.env`. Add `GOOGLE_CLIENT_ID=` to `.env.example` too.

---

## Task 2: Backend — Write failing tests for Google auth endpoint

**Files:**
- Create: `apps/backend/tests/Feature/Auth/GoogleAuthTest.php`

- [ ] **Step 1: Write test file**

```php
<?php

use App\Infrastructure\Persistence\Models\UserModel;

it('rejects request without id_token', function () {
    $response = $this->postJson('/api/v1/auth/google', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['id_token']);
});

it('rejects invalid google id_token', function () {
    $response = $this->postJson('/api/v1/auth/google', [
        'id_token' => 'invalid-token-string',
    ]);

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'INVALID_GOOGLE_TOKEN',
            ],
        ]);
});

it('creates new user and returns token for valid google sign-in', function () {
    // Mock Google_Client to return valid payload
    $mockPayload = [
        'sub' => '110248495921238986420',
        'email' => 'newuser@gmail.com',
        'name' => 'New User',
        'picture' => 'https://lh3.googleusercontent.com/photo.jpg',
        'email_verified' => true,
    ];

    $mockClient = Mockery::mock(\Google\Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('verifyIdToken')
        ->with('valid-google-token')
        ->once()
        ->andReturn($mockPayload);

    $this->app->instance(\Google\Client::class, $mockClient);

    $response = $this->postJson('/api/v1/auth/google', [
        'id_token' => 'valid-google-token',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'is_super_admin'],
                'token',
            ],
        ]);

    expect($response->json('data.user.email'))->toBe('newuser@gmail.com');
    expect($response->json('data.user.name'))->toBe('New User');

    $this->assertDatabaseHas('users', [
        'email' => 'newuser@gmail.com',
        'name' => 'New User',
    ]);
});

it('logs in existing user for valid google sign-in', function () {
    $existing = UserModel::create([
        'name' => 'Existing User',
        'email' => 'existing@gmail.com',
        'password' => 'some-password',
    ]);

    $mockPayload = [
        'sub' => '110248495921238986420',
        'email' => 'existing@gmail.com',
        'name' => 'Existing User Google Name',
        'picture' => 'https://lh3.googleusercontent.com/photo.jpg',
        'email_verified' => true,
    ];

    $mockClient = Mockery::mock(\Google\Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('verifyIdToken')
        ->with('valid-google-token')
        ->once()
        ->andReturn($mockPayload);

    $this->app->instance(\Google\Client::class, $mockClient);

    $response = $this->postJson('/api/v1/auth/google', [
        'id_token' => 'valid-google-token',
    ]);

    $response->assertStatus(200);

    // Should use existing user, not create new one
    expect($response->json('data.user.id'))->toBe($existing->id);
    expect($response->json('data.user.email'))->toBe('existing@gmail.com');

    // Should not duplicate user
    expect(UserModel::where('email', 'existing@gmail.com')->count())->toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/backend
php artisan test tests/Feature/Auth/GoogleAuthTest.php
```

Expected: All tests fail (route not found / 404).

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/Auth/GoogleAuthTest.php
git commit -m "test(backend): add failing tests for Google auth endpoint"
```

---

## Task 3: Backend — Implement Google auth endpoint

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Requests/Auth/GoogleLoginRequest.php`
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Auth/GoogleAuthController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create GoogleLoginRequest**

```php
<?php

namespace App\Infrastructure\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class GoogleLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'id_token' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'id_token.required' => 'El token de Google es obligatorio.',
        ];
    }
}
```

- [ ] **Step 2: Create GoogleAuthController**

```php
<?php

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Auth\GoogleLoginRequest;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Google\Client as GoogleClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class GoogleAuthController extends Controller
{
    public function login(GoogleLoginRequest $request): JsonResponse
    {
        $client = app(GoogleClient::class);
        $client->setClientId(config('services.google.client_id'));

        $payload = $client->verifyIdToken($request->id_token);

        if (!$payload) {
            return response()->json([
                'error' => [
                    'code' => 'INVALID_GOOGLE_TOKEN',
                    'message' => 'Token de Google inválido.',
                ],
            ], 401);
        }

        $email = $payload['email'];
        $name = $payload['name'] ?? 'Usuario';

        $user = UserModel::where('email', $email)->first();

        if (!$user) {
            $user = UserModel::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(Str::random(32)),
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $tenantUser = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->is_super_admin,
                ],
                'token' => $token,
                'tenant' => $tenantUser ? [
                    'id' => $tenantUser->tenant->id,
                    'slug' => $tenantUser->tenant->slug,
                    'name' => $tenantUser->tenant->name,
                ] : null,
            ],
        ]);
    }
}
```

- [ ] **Step 3: Add route to api.php**

In `routes/api.php`, add the import at the top:

```php
use App\Infrastructure\Http\Controllers\Auth\GoogleAuthController;
```

Then inside the `Route::prefix('v1')` group, after the `auth/login` route (line 31), add:

```php
    Route::post('auth/google', [GoogleAuthController::class, 'login']);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/backend
php artisan test tests/Feature/Auth/GoogleAuthTest.php
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run full auth test suite to check no regressions**

```bash
php artisan test tests/Feature/Auth/
```

Expected: All tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add app/Infrastructure/Http/Controllers/Auth/GoogleAuthController.php \
        app/Infrastructure/Http/Requests/Auth/GoogleLoginRequest.php \
        routes/api.php
git commit -m "feat(backend): implement POST /auth/google endpoint with idToken verification"
```

---

## Task 4: Flutter — Add google_sign_in dependency

**Files:**
- Modify: `apps/customer_v2/pubspec.yaml`

- [ ] **Step 1: Add dependency to pubspec.yaml**

Add under `dependencies:`, after the `flutter_secure_storage` line:

```yaml
  google_sign_in: ^6.2.1
```

- [ ] **Step 2: Install**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter pub get
```

Expected: Resolves without errors.

- [ ] **Step 3: Commit**

```bash
git add pubspec.yaml pubspec.lock
git commit -m "feat(customer_v2): add google_sign_in dependency"
```

---

## Task 5: Flutter — Extend auth repository with loginWithGoogle

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/domain/repositories/auth_repository.dart`
- Modify: `apps/customer_v2/lib/features/auth/data/repositories/auth_repository_impl.dart`

- [ ] **Step 1: Add method to repository interface**

In `auth_repository.dart`, add after the `isAuthenticated()` method:

```dart
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle();
```

- [ ] **Step 2: Implement in auth_repository_impl.dart**

Add these imports at the top of `auth_repository_impl.dart`:

```dart
import 'package:google_sign_in/google_sign_in.dart';
```

Add the method implementation in `AuthRepositoryImpl`:

```dart
  @override
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() async {
    try {
      final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      final account = await googleSignIn.signIn();

      if (account == null) {
        return left(ServerFailure('Inicio de sesión cancelado'));
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;

      if (idToken == null) {
        return left(ServerFailure('Error al obtener token de Google'));
      }

      final response = await ApiClient.instance.post(
        '/auth/google',
        data: {'id_token': idToken},
      );

      final dto = AuthResponseDto.fromJson(response.data['data']);
      await SecureStorage.saveToken(dto.token);

      return right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        final msg = e.response?.data['error']?['message'] ?? 'Token de Google inválido';
        return left(ServerFailure(msg));
      }
      return left(ServerFailure(_extractError(e.response?.data)));
    } catch (e) {
      return left(ServerFailure('Error al iniciar con Google'));
    }
  }
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter analyze lib/features/auth/
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/features/auth/domain/repositories/auth_repository.dart \
        lib/features/auth/data/repositories/auth_repository_impl.dart
git commit -m "feat(customer_v2): implement loginWithGoogle in auth repository"
```

---

## Task 6: Flutter — Add loginWithGoogle to AuthCubit

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/presentation/cubit/auth_cubit.dart`

- [ ] **Step 1: Add method to AuthCubit**

Add after the existing `register()` method:

```dart
  Future<void> loginWithGoogle() async {
    emit(AuthLoading());
    final result = await _authRepository.loginWithGoogle();
    result.fold(
      (failure) {
        if (failure.message == 'Inicio de sesión cancelado') {
          emit(AuthInitial());
        } else {
          emit(AuthError(failure.message));
        }
      },
      (data) => emit(AuthAuthenticated(data.user)),
    );
  }
```

Note: If user cancels Google picker, emit `AuthInitial()` (not error) so UI returns to normal state silently.

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter analyze lib/features/auth/presentation/cubit/
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/features/auth/presentation/cubit/auth_cubit.dart
git commit -m "feat(customer_v2): add loginWithGoogle to AuthCubit"
```

---

## Task 7: Flutter — Create Google Sign-In button widget

**Files:**
- Create: `apps/customer_v2/lib/features/auth/presentation/widgets/google_sign_in_button.dart`

- [ ] **Step 1: Create the widget**

```dart
import 'package:flutter/material.dart';

class GoogleSignInButton extends StatelessWidget {
  final VoidCallback onPressed;
  final bool isLoading;

  const GoogleSignInButton({
    super.key,
    required this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white,
          side: const BorderSide(color: Color(0xFFDADCE0)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.network(
                    'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                    height: 20,
                    width: 20,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.g_mobiledata,
                      size: 24,
                      color: Color(0xFF4285F4),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Continuar con Google',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1F1F1F),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter analyze lib/features/auth/presentation/widgets/
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/features/auth/presentation/widgets/google_sign_in_button.dart
git commit -m "feat(customer_v2): create GoogleSignInButton widget"
```

---

## Task 8: Flutter — Add Google Sign-In to login screen

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/presentation/screens/login_screen.dart`

- [ ] **Step 1: Add imports**

Add at the top of `login_screen.dart`:

```dart
import 'package:customer_v2/features/auth/presentation/widgets/google_sign_in_button.dart';
```

- [ ] **Step 2: Add Google button and divider after the login button**

After the "Iniciar Sesion" button (around line 294, after the closing `)` of the main ElevatedButton), add:

```dart
                          const SizedBox(height: 20),

                          // Divider
                          Row(
                            children: [
                              Expanded(child: Divider(color: Colors.grey.shade300)),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: Text(
                                  'o',
                                  style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              Expanded(child: Divider(color: Colors.grey.shade300)),
                            ],
                          ),

                          const SizedBox(height: 20),

                          // Google Sign-In button
                          GoogleSignInButton(
                            isLoading: state is AuthLoading,
                            onPressed: () {
                              context.read<AuthCubit>().loginWithGoogle();
                            },
                          ),
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter analyze lib/features/auth/presentation/screens/login_screen.dart
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/features/auth/presentation/screens/login_screen.dart
git commit -m "feat(customer_v2): add Google Sign-In button to login screen"
```

---

## Task 9: Flutter — Add Google Sign-In to register screen

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/presentation/screens/register_screen.dart`

- [ ] **Step 1: Add imports**

Add at the top of `register_screen.dart`:

```dart
import 'package:customer_v2/features/auth/presentation/widgets/google_sign_in_button.dart';
```

- [ ] **Step 2: Add Google button before the registration form**

After the "Crear Cuenta" title/description section (around line 172, before the Name field), add:

```dart
                          // Google Sign-In button
                          GoogleSignInButton(
                            isLoading: state is AuthLoading,
                            onPressed: () {
                              context.read<AuthCubit>().loginWithGoogle();
                            },
                          ),

                          const SizedBox(height: 20),

                          // Divider
                          Row(
                            children: [
                              Expanded(child: Divider(color: Colors.grey.shade300)),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: Text(
                                  'o',
                                  style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              Expanded(child: Divider(color: Colors.grey.shade300)),
                            ],
                          ),

                          const SizedBox(height: 20),
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter analyze lib/features/auth/presentation/screens/register_screen.dart
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/features/auth/presentation/screens/register_screen.dart
git commit -m "feat(customer_v2): add Google Sign-In button to register screen"
```

---

## Task 10: Google Cloud Console — OAuth setup (manual)

This task is done by the developer in the browser, not by code.

- [ ] **Step 1: Configure OAuth consent screen**

Go to Google Cloud Console > APIs & Services > OAuth consent screen:
- App name: `Turnly`
- User support email: `korbold@live.com`
- Scopes: add `email`, `profile`, `openid`
- Test users: add `korbold@live.com`
- Save

- [ ] **Step 2: Get SHA-1 fingerprint from debug keystore**

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android 2>&1 | grep SHA1
```

Copy the SHA-1 hash.

- [ ] **Step 3: Create Android OAuth Client ID**

Go to Credentials > Create Credentials > OAuth Client ID:
- Application type: Android
- Package name: `com.turnly.customer_v2`
- SHA-1 certificate fingerprint: paste from Step 2
- Save

- [ ] **Step 4: Create Web OAuth Client ID**

Go to Credentials > Create Credentials > OAuth Client ID:
- Application type: Web application
- Name: `Turnly Backend`
- No authorized origins/redirects needed
- Save
- Copy the Client ID

- [ ] **Step 5: Update backend .env with real client ID**

Replace placeholder in `apps/backend/.env`:

```
GOOGLE_CLIENT_ID=<paste-web-client-id>.apps.googleusercontent.com
```

- [ ] **Step 6: Smoke test**

Run the Flutter app on Android emulator/device. Tap "Continuar con Google", select account, verify login succeeds and redirects to /home.
