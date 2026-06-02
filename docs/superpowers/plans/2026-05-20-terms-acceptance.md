# Terms & Conditions Acceptance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block new users from entering the app until they accept T&C and Privacy Policy, with acceptance recorded server-side including version tracking.

**Architecture:** Backend adds `terms_accepted_at` + `terms_version_accepted` to `users` table and a `POST /auth/accept-terms` endpoint; all auth responses include these fields. Flutter adds `AuthTermsPending` state to `AuthCubit`, a new `TermsAcceptanceCubit`, and a full-screen animated `TermsAcceptanceScreen` at `/accept-terms`. The router enforces the gate via a `SecureStorage` boolean flag. Magic-link flow also gets the field in its response.

**Tech Stack:** Laravel 13 + Pest (backend), Flutter 3 + flutter_bloc + go_router + flutter_animate + fpdart (mobile).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/backend/database/migrations/2026_05_20_000001_add_terms_accepted_to_users_table.php` | Add two columns to users |
| Modify | `apps/backend/app/Infrastructure/Persistence/Models/UserModel.php` | Add fields to fillable + casts |
| Modify | `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php` | Include fields in responses + acceptTerms method |
| Modify | `apps/backend/app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php` | Include fields in verify response |
| Modify | `apps/backend/routes/api.php` | Add POST auth/accept-terms route |
| Create | `apps/backend/tests/Feature/Auth/AcceptTermsTest.php` | Feature tests for endpoint |
| Modify | `apps/customer_v2/lib/features/auth/domain/entities/user.dart` | Add termsAcceptedAt field |
| Modify | `apps/customer_v2/lib/features/auth/data/dtos/auth_dto.dart` | Parse + serialize termsAcceptedAt |
| Modify | `apps/customer_v2/lib/core/storage/secure_storage.dart` | Add setTermsAccepted/getTermsAccepted |
| Modify | `apps/customer_v2/lib/features/auth/domain/repositories/auth_repository.dart` | Add acceptTerms abstract method |
| Modify | `apps/customer_v2/lib/features/auth/data/repositories/auth_repository_impl.dart` | Implement acceptTerms |
| Modify | `apps/customer_v2/lib/features/auth/presentation/cubit/auth_state.dart` | Add AuthTermsPending |
| Modify | `apps/customer_v2/lib/features/auth/presentation/cubit/auth_cubit.dart` | Emit AuthTermsPending when termsAcceptedAt == null |
| Create | `apps/customer_v2/lib/features/terms/presentation/cubit/terms_acceptance_state.dart` | Sealed state: Idle/Loading/Success/Error |
| Create | `apps/customer_v2/lib/features/terms/presentation/cubit/terms_acceptance_cubit.dart` | Calls acceptTerms + sets SecureStorage flag |
| Create | `apps/customer_v2/lib/features/terms/presentation/screens/terms_acceptance_screen.dart` | Full-screen UI with stagger animations |
| Modify | `apps/customer_v2/lib/app/router.dart` | Add redirect + /accept-terms route |
| Modify | `apps/customer_v2/lib/features/auth/presentation/screens/login_screen.dart` | Handle AuthTermsPending → navigate |
| Create | `apps/customer_v2/test/features/auth/auth_dto_test.dart` | DTO parsing tests |
| Create | `apps/customer_v2/test/features/auth/auth_cubit_terms_test.dart` | Cubit state emission tests |
| Create | `apps/customer_v2/test/features/terms/terms_acceptance_cubit_test.dart` | Cubit unit tests |
| Create | `apps/customer_v2/test/features/terms/terms_acceptance_screen_test.dart` | Widget tests |

---

### Task 1: Backend — Migration, model, and auth response updates

**Files:**
- Create: `apps/backend/database/migrations/2026_05_20_000001_add_terms_accepted_to_users_table.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/UserModel.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php`

- [ ] **Step 1: Create the migration file**

Create `apps/backend/database/migrations/2026_05_20_000001_add_terms_accepted_to_users_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('terms_accepted_at')->nullable()->after('email_verified_at');
            $table->string('terms_version_accepted', 10)->nullable()->after('terms_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['terms_accepted_at', 'terms_version_accepted']);
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/backend
php artisan migrate
```

Expected output includes: `Migrating: 2026_05_20_000001_add_terms_accepted_to_users_table` then `Migrated`.

- [ ] **Step 3: Update UserModel — fillable + casts**

In `apps/backend/app/Infrastructure/Persistence/Models/UserModel.php`, replace the `$fillable` array with:

```php
protected $fillable = [
    'name', 'email', 'password', 'phone',
    'terms_accepted_at', 'terms_version_accepted',
];
```

In the `casts()` method, add `'terms_accepted_at' => 'datetime'` alongside the existing casts:

```php
protected function casts(): array
{
    return [
        'email_verified_at' => 'datetime',
        'terms_accepted_at' => 'datetime',
        'password' => 'hashed',
        'is_super_admin' => 'boolean',
    ];
}
```

- [ ] **Step 4: Update `register()` response in AuthController**

In `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php`, in `register()`, add `'terms_accepted_at'` to the returned user array. The full user array in that method becomes:

```php
'user' => [
    'id' => $result['user']->id,
    'name' => $result['user']->name,
    'email' => $result['user']->email,
    'email_verified' => false,
    'terms_accepted_at' => $result['user']->terms_accepted_at?->toIso8601String(),
],
```

- [ ] **Step 5: Update `login()` response in AuthController**

In the `login()` method, add `'terms_accepted_at'` to the user array. The full user array becomes:

```php
'user' => [
    'id' => $user->id,
    'name' => $user->name,
    'email' => $user->email,
    'is_super_admin' => $user->is_super_admin,
    'email_verified' => $user->email_verified_at !== null,
    'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
],
```

- [ ] **Step 6: Update `verifyEmail()` response in AuthController**

In the `verifyEmail()` method, the response returns a `'user'` array. Add `'terms_accepted_at'` to it. The full user array in that response becomes:

```php
'user' => [
    'id' => $user->id,
    'name' => $user->name,
    'email' => $user->email,
    'is_super_admin' => (bool) $user->is_super_admin,
    'terms_accepted_at' => $user->fresh()->terms_accepted_at?->toIso8601String(),
],
```

Note: `$user->fresh()` is already called in that method for `email_verified_at`; reuse that result.

- [ ] **Step 7: Update `me()` response in AuthController**

In the `me()` method, add `'terms_accepted_at'` to the user array:

```php
'user' => [
    'id' => $user->id,
    'name' => $user->name,
    'email' => $user->email,
    'is_super_admin' => $user->is_super_admin,
    'role' => $tenantUser?->role,
    'email_verified' => $user->email_verified_at !== null,
    'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
],
```

- [ ] **Step 8: Update MagicLinkController `verify()` response**

In `apps/backend/app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php`, in the `verify()` method's success response, add `'terms_accepted_at'` to the user object:

```php
'user' => [
    'id' => $user->id,
    'name' => $user->name,
    'email' => $user->email,
    'is_super_admin' => $user->is_super_admin,
    'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
],
```

- [ ] **Step 9: Run existing backend tests to verify no regressions**

```bash
cd apps/backend
composer test
```

Expected: all existing tests pass.

- [ ] **Step 10: Commit**

```bash
cd apps/backend
git add database/migrations/2026_05_20_000001_add_terms_accepted_to_users_table.php \
        app/Infrastructure/Persistence/Models/UserModel.php \
        app/Infrastructure/Http/Controllers/Auth/AuthController.php \
        app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php
git commit -m "feat: add terms_accepted_at column and include in auth responses"
```

---

### Task 2: Backend — accept-terms endpoint

**Files:**
- Modify: `apps/backend/routes/api.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php`
- Create: `apps/backend/tests/Feature/Auth/AcceptTermsTest.php`

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/tests/Feature/Auth/AcceptTermsTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('authenticated user can accept terms', function () {
    $user = UserModel::factory()->create([
        'email_verified_at' => now(),
        'terms_accepted_at' => null,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/auth/accept-terms', ['version' => '1.0']);

    $response->assertOk()
        ->assertJsonPath('data.terms_version_accepted', '1.0');

    expect($user->fresh()->terms_accepted_at)->not->toBeNull();
    expect($user->fresh()->terms_version_accepted)->toBe('1.0');
});

test('accept-terms requires authentication', function () {
    $this->postJson('/api/auth/accept-terms', ['version' => '1.0'])
        ->assertUnauthorized();
});

test('accept-terms requires version field', function () {
    $user = UserModel::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/auth/accept-terms', [])
        ->assertUnprocessable();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend
php artisan test --filter=AcceptTermsTest
```

Expected: all 3 fail — route not found or 404.

- [ ] **Step 3: Add the route**

Open `apps/backend/routes/api.php`. Inside the `Route::middleware('auth:sanctum')->group(function () {` block (around line 62), add:

```php
Route::post('auth/accept-terms', [AuthController::class, 'acceptTerms']);
```

Verify `AuthController` is already imported at the top of the routes file (it should be, since `auth/login` and `auth/register` already use it).

- [ ] **Step 4: Add `acceptTerms()` to AuthController**

In `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php`, add this method after the `me()` method:

```php
public function acceptTerms(Request $request): JsonResponse
{
    $request->validate([
        'version' => ['required', 'string', 'max:10'],
    ]);

    $request->user()->update([
        'terms_accepted_at' => now(),
        'terms_version_accepted' => $request->string('version')->toString(),
    ]);

    $user = $request->user()->fresh();

    return response()->json([
        'data' => [
            'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
            'terms_version_accepted' => $user->terms_version_accepted,
        ],
        'meta' => ['timestamp' => now()->toIso8601String()],
    ]);
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd apps/backend
php artisan test --filter=AcceptTermsTest
```

Expected: 3 tests, 3 passed.

- [ ] **Step 6: Commit**

```bash
cd apps/backend
git add routes/api.php \
        app/Infrastructure/Http/Controllers/Auth/AuthController.php \
        tests/Feature/Auth/AcceptTermsTest.php
git commit -m "feat: add POST /auth/accept-terms endpoint"
```

---

### Task 3: Flutter — Data layer

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/domain/entities/user.dart`
- Modify: `apps/customer_v2/lib/features/auth/data/dtos/auth_dto.dart`
- Modify: `apps/customer_v2/lib/core/storage/secure_storage.dart`
- Modify: `apps/customer_v2/lib/features/auth/domain/repositories/auth_repository.dart`
- Modify: `apps/customer_v2/lib/features/auth/data/repositories/auth_repository_impl.dart`
- Create: `apps/customer_v2/test/features/auth/auth_dto_test.dart`

- [ ] **Step 1: Write the failing DTO test**

Create `apps/customer_v2/test/features/auth/auth_dto_test.dart`:

```dart
import 'package:customer_v2/features/auth/data/dtos/auth_dto.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('UserDto.fromJson', () {
    test('parses terms_accepted_at when present', () {
      final dto = UserDto.fromJson({
        'id': '1',
        'name': 'Ana',
        'email': 'ana@test.com',
        'email_verified': true,
        'terms_accepted_at': '2026-05-20T18:00:00Z',
      });
      expect(dto.termsAcceptedAt, isNotNull);
      expect(dto.toEntity().termsAcceptedAt, isNotNull);
    });

    test('parses null terms_accepted_at', () {
      final dto = UserDto.fromJson({
        'id': '1',
        'name': 'Ana',
        'email': 'ana@test.com',
        'email_verified': true,
        'terms_accepted_at': null,
      });
      expect(dto.termsAcceptedAt, isNull);
      expect(dto.toEntity().termsAcceptedAt, isNull);
    });

    test('round-trips through toJson/fromJson', () {
      final original = UserDto(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
        termsAcceptedAt: DateTime.parse('2026-05-20T18:00:00.000Z'),
      );
      final roundTripped = UserDto.fromJson(original.toJson());
      expect(
        roundTripped.termsAcceptedAt?.toUtc().toIso8601String(),
        equals(original.termsAcceptedAt?.toUtc().toIso8601String()),
      );
    });
  });
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/customer_v2
fvm flutter test test/features/auth/auth_dto_test.dart
```

Expected: compile error — `termsAcceptedAt` property not found on `UserDto`.

- [ ] **Step 3: Update User entity**

Replace the full content of `apps/customer_v2/lib/features/auth/domain/entities/user.dart`:

```dart
// lib/features/auth/domain/entities/user.dart
import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final bool emailVerified;
  final DateTime? termsAcceptedAt;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
    this.emailVerified = true,
    this.termsAcceptedAt,
  });

  @override
  List<Object?> get props =>
      [id, name, email, phone, isSuperAdmin, emailVerified, termsAcceptedAt];
}
```

- [ ] **Step 4: Update UserDto**

Replace the full content of `apps/customer_v2/lib/features/auth/data/dtos/auth_dto.dart`:

```dart
// lib/features/auth/data/dtos/auth_dto.dart
import '../../domain/entities/user.dart';

class AuthResponseDto {
  final UserDto user;
  final String token;

  AuthResponseDto({required this.user, required this.token});

  factory AuthResponseDto.fromJson(Map<String, dynamic> json) {
    return AuthResponseDto(
      user: UserDto.fromJson(json['user'] as Map<String, dynamic>),
      token: json['token'] as String,
    );
  }
}

class UserDto {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final bool emailVerified;
  final DateTime? termsAcceptedAt;

  UserDto({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
    this.emailVerified = true,
    this.termsAcceptedAt,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    final rawTerms = json['terms_accepted_at'];
    return UserDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      isSuperAdmin: json['is_super_admin'] as bool? ?? false,
      emailVerified: json['email_verified'] as bool? ?? true,
      termsAcceptedAt: rawTerms is String ? DateTime.tryParse(rawTerms) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phone': phone,
    'is_super_admin': isSuperAdmin,
    'email_verified': emailVerified,
    'terms_accepted_at': termsAcceptedAt?.toIso8601String(),
  };

  User toEntity() => User(
    id: id,
    name: name,
    email: email,
    phone: phone,
    isSuperAdmin: isSuperAdmin,
    emailVerified: emailVerified,
    termsAcceptedAt: termsAcceptedAt,
  );
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd apps/customer_v2
fvm flutter test test/features/auth/auth_dto_test.dart
```

Expected: 3 tests, 3 passed.

- [ ] **Step 6: Update SecureStorage**

Replace the full content of `apps/customer_v2/lib/core/storage/secure_storage.dart`:

```dart
// lib/core/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage();

  static const _tokenKey = 'auth_token';
  static const _tenantSlugKey = 'tenant_slug';
  static const _userKey = 'user_data';
  static const _termsAcceptedKey = 'terms_accepted';

  // Token
  static Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  static Future<String?> getToken() => _storage.read(key: _tokenKey);

  static Future<void> deleteToken() => _storage.delete(key: _tokenKey);

  // Tenant
  static Future<void> saveTenantSlug(String slug) =>
      _storage.write(key: _tenantSlugKey, value: slug);

  static Future<String?> getTenantSlug() =>
      _storage.read(key: _tenantSlugKey);

  // User data
  static Future<void> saveUserData(String json) =>
      _storage.write(key: _userKey, value: json);

  static Future<String?> getUserData() => _storage.read(key: _userKey);

  // Terms acceptance
  static Future<void> setTermsAccepted(bool accepted) =>
      _storage.write(key: _termsAcceptedKey, value: accepted ? 'true' : 'false');

  static Future<bool> getTermsAccepted() async {
    final value = await _storage.read(key: _termsAcceptedKey);
    return value == 'true';
  }

  // Clear all
  static Future<void> clear() => _storage.deleteAll();
}
```

- [ ] **Step 7: Add acceptTerms to AuthRepository interface**

Replace the full content of `apps/customer_v2/lib/features/auth/domain/repositories/auth_repository.dart`:

```dart
// lib/features/auth/domain/repositories/auth_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/user.dart';

abstract class AuthRepository {
  Future<Either<Failure, ({User user, String token})>> login(String email, String password);
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  });
  Future<Either<Failure, User>> getMe();
  Future<Either<Failure, Unit>> logout();
  Future<bool> isAuthenticated();
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle();
  Future<Either<Failure, Unit>> verifyEmail({required String email, required String code});
  Future<Either<Failure, Unit>> resendVerification({required String email});
  Future<Either<Failure, Unit>> sendMagicLink(String email);
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  });
  Future<Either<Failure, Unit>> acceptTerms({required String version});
}
```

- [ ] **Step 8: Implement acceptTerms in AuthRepositoryImpl**

Open `apps/customer_v2/lib/features/auth/data/repositories/auth_repository_impl.dart`. Add this method before the `_extractError` helper at the bottom of the class:

```dart
@override
Future<Either<Failure, Unit>> acceptTerms({required String version}) async {
  try {
    await _dio.post('/auth/accept-terms', data: {'version': version});
    return const Right(unit);
  } on DioException catch (e) {
    return Left(_extractError(e, 'No se pudo registrar la aceptación'));
  } catch (e) {
    return Left(ServerFailure(e.toString()));
  }
}
```

- [ ] **Step 9: Run all tests**

```bash
cd apps/customer_v2
fvm flutter test
```

Expected: all tests pass (including the new auth_dto_test).

- [ ] **Step 10: Commit**

```bash
cd apps/customer_v2
git add lib/features/auth/domain/entities/user.dart \
        lib/features/auth/data/dtos/auth_dto.dart \
        lib/core/storage/secure_storage.dart \
        lib/features/auth/domain/repositories/auth_repository.dart \
        lib/features/auth/data/repositories/auth_repository_impl.dart \
        test/features/auth/auth_dto_test.dart
git commit -m "feat: add termsAcceptedAt to user, DTO, SecureStorage, and AuthRepository"
```

---

### Task 4: Flutter — AuthState + AuthCubit

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/presentation/cubit/auth_state.dart`
- Modify: `apps/customer_v2/lib/features/auth/presentation/cubit/auth_cubit.dart`
- Create: `apps/customer_v2/test/features/auth/auth_cubit_terms_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `apps/customer_v2/test/features/auth/auth_cubit_terms_test.dart`:

```dart
import 'package:customer_v2/core/error/failures.dart';
import 'package:customer_v2/features/auth/domain/entities/user.dart';
import 'package:customer_v2/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_v2/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:customer_v2/features/auth/presentation/cubit/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

class _FakeAuthRepository extends AuthRepository {
  final User userToReturn;
  _FakeAuthRepository(this.userToReturn);

  @override
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() async =>
      Right((user: userToReturn, token: 'tok'));

  @override
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  }) async =>
      Right((user: userToReturn, token: 'tok'));

  @override
  Future<Either<Failure, ({User user, String token})>> login(String e, String p) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, User>> getMe() => throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> logout() => throw UnimplementedError();
  @override
  Future<bool> isAuthenticated() => throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> verifyEmail({
    required String email,
    required String code,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> resendVerification({required String email}) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> sendMagicLink(String email) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> acceptTerms({required String version}) =>
      throw UnimplementedError();
}

void main() {
  group('AuthCubit — terms pending', () {
    test('loginWithGoogle emits AuthTermsPending when termsAcceptedAt is null', () async {
      const user = User(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
      );
      final cubit = AuthCubit(_FakeAuthRepository(user));
      await cubit.loginWithGoogle();
      expect(cubit.state, isA<AuthTermsPending>());
    });

    test('loginWithGoogle emits AuthAuthenticated when terms already accepted', () async {
      final user = User(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
        termsAcceptedAt: DateTime(2026, 1, 1),
      );
      final cubit = AuthCubit(_FakeAuthRepository(user));
      await cubit.loginWithGoogle();
      expect(cubit.state, isA<AuthAuthenticated>());
    });

    test('signInWithEmailLink emits AuthTermsPending when termsAcceptedAt is null', () async {
      const user = User(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
      );
      final cubit = AuthCubit(_FakeAuthRepository(user));
      await cubit.signInWithEmailLink(
        email: 'ana@test.com',
        link: 'https://dev.goturnly.com/m/${'a' * 64}',
      );
      expect(cubit.state, isA<AuthTermsPending>());
    });
  });
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/customer_v2
fvm flutter test test/features/auth/auth_cubit_terms_test.dart
```

Expected: compile error — `AuthTermsPending` not defined.

- [ ] **Step 3: Add AuthTermsPending to auth_state.dart**

Open `apps/customer_v2/lib/features/auth/presentation/cubit/auth_state.dart`. Add after the `AuthMagicLinkSent` class:

```dart
/// Emitted after successful auth when the user has not yet accepted the
/// Terms & Conditions. UI navigates to /accept-terms.
class AuthTermsPending extends AuthState {
  const AuthTermsPending();
}
```

- [ ] **Step 4: Update loginWithGoogle in auth_cubit.dart**

In `apps/customer_v2/lib/features/auth/presentation/cubit/auth_cubit.dart`, replace the `loginWithGoogle()` method:

```dart
Future<void> loginWithGoogle() async {
  emit(const AuthLoading());
  final result = await _repository.loginWithGoogle();
  result.fold(
    (failure) {
      if (failure.message == 'Inicio de sesión cancelado') {
        emit(const AuthInitial());
      } else {
        emit(AuthError(failure.message));
      }
    },
    (data) {
      if (data.user.termsAcceptedAt == null) {
        emit(const AuthTermsPending());
      } else {
        emit(AuthAuthenticated(data.user));
        getIt<PushNotificationService>().init();
      }
    },
  );
}
```

- [ ] **Step 5: Update signInWithEmailLink in auth_cubit.dart**

Replace the `signInWithEmailLink()` method:

```dart
Future<void> signInWithEmailLink({
  required String email,
  required String link,
}) async {
  emit(const AuthLoading());
  final result = await _repository.signInWithEmailLink(
    email: email,
    link: link,
  );
  result.fold(
    (failure) => emit(AuthError(failure.message)),
    (data) {
      if (data.user.termsAcceptedAt == null) {
        emit(const AuthTermsPending());
      } else {
        emit(AuthAuthenticated(data.user));
        getIt<PushNotificationService>().init();
      }
    },
  );
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd apps/customer_v2
fvm flutter test test/features/auth/auth_cubit_terms_test.dart
```

Expected: 3 tests, 3 passed.

- [ ] **Step 7: Commit**

```bash
cd apps/customer_v2
git add lib/features/auth/presentation/cubit/auth_state.dart \
        lib/features/auth/presentation/cubit/auth_cubit.dart \
        test/features/auth/auth_cubit_terms_test.dart
git commit -m "feat: emit AuthTermsPending when user has not accepted T&C"
```

---

### Task 5: Flutter — TermsAcceptanceCubit

**Files:**
- Create: `apps/customer_v2/lib/features/terms/presentation/cubit/terms_acceptance_state.dart`
- Create: `apps/customer_v2/lib/features/terms/presentation/cubit/terms_acceptance_cubit.dart`
- Create: `apps/customer_v2/test/features/terms/terms_acceptance_cubit_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `apps/customer_v2/test/features/terms/terms_acceptance_cubit_test.dart`:

```dart
import 'package:customer_v2/core/error/failures.dart';
import 'package:customer_v2/features/auth/domain/entities/user.dart';
import 'package:customer_v2/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_v2/features/terms/presentation/cubit/terms_acceptance_cubit.dart';
import 'package:customer_v2/features/terms/presentation/cubit/terms_acceptance_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

class _MockAuthRepository extends AuthRepository {
  Failure? failureToReturn;

  @override
  Future<Either<Failure, Unit>> acceptTerms({required String version}) async {
    if (failureToReturn != null) return Left(failureToReturn!);
    return const Right(unit);
  }

  @override
  Future<Either<Failure, ({User user, String token})>> login(String e, String p) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, User>> getMe() => throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> logout() => throw UnimplementedError();
  @override
  Future<bool> isAuthenticated() => throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> verifyEmail({
    required String email,
    required String code,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> resendVerification({required String email}) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> sendMagicLink(String email) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  }) =>
      throw UnimplementedError();
}

void main() {
  group('TermsAcceptanceCubit', () {
    test('starts in TermsAcceptanceIdle', () {
      final cubit = TermsAcceptanceCubit(_MockAuthRepository());
      expect(cubit.state, isA<TermsAcceptanceIdle>());
    });

    test('accept() emits Loading then Success on success', () async {
      final cubit = TermsAcceptanceCubit(_MockAuthRepository());
      final states = <TermsAcceptanceState>[];
      cubit.stream.listen(states.add);

      await cubit.accept();

      expect(states[0], isA<TermsAcceptanceLoading>());
      expect(states[1], isA<TermsAcceptanceSuccess>());
    });

    test('accept() emits Loading then Error on failure', () async {
      final repo = _MockAuthRepository()
        ..failureToReturn = const ServerFailure('red no disponible');
      final cubit = TermsAcceptanceCubit(repo);
      final states = <TermsAcceptanceState>[];
      cubit.stream.listen(states.add);

      await cubit.accept();

      expect(states[0], isA<TermsAcceptanceLoading>());
      expect(states[1], isA<TermsAcceptanceError>());
      expect((states[1] as TermsAcceptanceError).message, 'red no disponible');
    });
  });
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/customer_v2
fvm flutter test test/features/terms/terms_acceptance_cubit_test.dart
```

Expected: compile error — `TermsAcceptanceCubit` not found.

- [ ] **Step 3: Create terms_acceptance_state.dart**

Create `apps/customer_v2/lib/features/terms/presentation/cubit/terms_acceptance_state.dart`:

```dart
// lib/features/terms/presentation/cubit/terms_acceptance_state.dart
import 'package:equatable/equatable.dart';

sealed class TermsAcceptanceState extends Equatable {
  const TermsAcceptanceState();

  @override
  List<Object?> get props => [];
}

class TermsAcceptanceIdle extends TermsAcceptanceState {
  const TermsAcceptanceIdle();
}

class TermsAcceptanceLoading extends TermsAcceptanceState {
  const TermsAcceptanceLoading();
}

class TermsAcceptanceSuccess extends TermsAcceptanceState {
  const TermsAcceptanceSuccess();
}

class TermsAcceptanceError extends TermsAcceptanceState {
  final String message;
  const TermsAcceptanceError(this.message);

  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 4: Create terms_acceptance_cubit.dart**

Create `apps/customer_v2/lib/features/terms/presentation/cubit/terms_acceptance_cubit.dart`:

```dart
// lib/features/terms/presentation/cubit/terms_acceptance_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import 'terms_acceptance_state.dart';

class TermsAcceptanceCubit extends Cubit<TermsAcceptanceState> {
  final AuthRepository _repository;

  TermsAcceptanceCubit(this._repository) : super(const TermsAcceptanceIdle());

  Future<void> accept() async {
    emit(const TermsAcceptanceLoading());
    final result = await _repository.acceptTerms(version: '1.0');
    result.fold(
      (failure) => emit(TermsAcceptanceError(failure.message)),
      (_) async {
        await SecureStorage.setTermsAccepted(true);
        emit(const TermsAcceptanceSuccess());
      },
    );
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd apps/customer_v2
fvm flutter test test/features/terms/terms_acceptance_cubit_test.dart
```

Expected: 3 tests, 3 passed.

- [ ] **Step 6: Commit**

```bash
cd apps/customer_v2
git add lib/features/terms/presentation/cubit/terms_acceptance_state.dart \
        lib/features/terms/presentation/cubit/terms_acceptance_cubit.dart \
        test/features/terms/terms_acceptance_cubit_test.dart
git commit -m "feat: add TermsAcceptanceCubit and states"
```

---

### Task 6: Flutter — TermsAcceptanceScreen

**Files:**
- Create: `apps/customer_v2/lib/features/terms/presentation/screens/terms_acceptance_screen.dart`
- Create: `apps/customer_v2/test/features/terms/terms_acceptance_screen_test.dart`

- [ ] **Step 1: Write the failing widget tests**

Create `apps/customer_v2/test/features/terms/terms_acceptance_screen_test.dart`:

```dart
import 'package:customer_v2/core/error/failures.dart';
import 'package:customer_v2/features/auth/domain/entities/user.dart';
import 'package:customer_v2/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_v2/features/terms/presentation/cubit/terms_acceptance_cubit.dart';
import 'package:customer_v2/features/terms/presentation/screens/terms_acceptance_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

class _FakeRepo extends AuthRepository {
  bool shouldFail;
  _FakeRepo({this.shouldFail = false});

  @override
  Future<Either<Failure, Unit>> acceptTerms({required String version}) async {
    if (shouldFail) return const Left(ServerFailure('Error de red'));
    return const Right(unit);
  }

  @override
  Future<Either<Failure, ({User user, String token})>> login(String e, String p) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, User>> getMe() => throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> logout() => throw UnimplementedError();
  @override
  Future<bool> isAuthenticated() => throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> verifyEmail({
    required String email,
    required String code,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> resendVerification({required String email}) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> sendMagicLink(String email) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  }) =>
      throw UnimplementedError();
}

Widget _buildScreen({AuthRepository? repo}) => MaterialApp(
      home: BlocProvider(
        create: (_) => TermsAcceptanceCubit(repo ?? _FakeRepo()),
        child: const TermsAcceptanceBody(),
      ),
    );

void main() {
  group('TermsAcceptanceScreen', () {
    testWidgets('shows title and CTA', (tester) async {
      await tester.pumpWidget(_buildScreen());
      await tester.pumpAndSettle();

      expect(find.text('Antes de continuar'), findsOneWidget);
      expect(find.text('Continuar'), findsOneWidget);
    });

    testWidgets('CTA disabled when checkbox unchecked', (tester) async {
      await tester.pumpWidget(_buildScreen());
      await tester.pumpAndSettle();

      final button = tester.widget<ElevatedButton>(
        find.ancestor(
          of: find.text('Continuar'),
          matching: find.byType(ElevatedButton),
        ),
      );
      expect(button.onPressed, isNull);
    });

    testWidgets('CTA enabled after checking checkbox', (tester) async {
      await tester.pumpWidget(_buildScreen());
      await tester.pumpAndSettle();

      await tester.tap(find.byType(Checkbox));
      await tester.pumpAndSettle();

      final button = tester.widget<ElevatedButton>(
        find.ancestor(
          of: find.text('Continuar'),
          matching: find.byType(ElevatedButton),
        ),
      );
      expect(button.onPressed, isNotNull);
    });

    testWidgets('shows error message on TermsAcceptanceError state', (tester) async {
      await tester.pumpWidget(_buildScreen(repo: _FakeRepo(shouldFail: true)));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(Checkbox));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo registrar tu aceptación. Intenta de nuevo.'), findsOneWidget);
    });
  });
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/customer_v2
fvm flutter test test/features/terms/terms_acceptance_screen_test.dart
```

Expected: compile error — `TermsAcceptanceBody` not found.

- [ ] **Step 3: Create the screen**

Create `apps/customer_v2/lib/features/terms/presentation/screens/terms_acceptance_screen.dart`:

```dart
// lib/features/terms/presentation/screens/terms_acceptance_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/push/push_notification_service.dart';
import '../../../../features/auth/domain/repositories/auth_repository.dart';
import '../../../../features/legal/presentation/screens/legal_screen.dart';
import '../../../../shared/widgets/app_button.dart';
import '../cubit/terms_acceptance_cubit.dart';
import '../cubit/terms_acceptance_state.dart';

class TermsAcceptanceScreen extends StatelessWidget {
  const TermsAcceptanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => TermsAcceptanceCubit(getIt<AuthRepository>()),
      child: const TermsAcceptanceBody(),
    );
  }
}

/// Exported for widget testing — do not use directly in routes.
class TermsAcceptanceBody extends StatefulWidget {
  const TermsAcceptanceBody({super.key});

  @override
  State<TermsAcceptanceBody> createState() => _TermsAcceptanceBodyState();
}

class _TermsAcceptanceBodyState extends State<TermsAcceptanceBody> {
  bool _checked = false;

  void _openLegal(BuildContext context, LegalType type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.9,
        child: LegalScreen(type: type),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.of(context).disableAnimations;
    // After screen enters (320ms), content staggers at 40ms intervals.
    final baseDelay = reducedMotion ? Duration.zero : 320.ms;
    const stagger = Duration(milliseconds: 40);
    const contentDuration = Duration(milliseconds: 280);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: BlocConsumer<TermsAcceptanceCubit, TermsAcceptanceState>(
        listener: (context, state) {
          if (state is TermsAcceptanceSuccess) {
            getIt<PushNotificationService>().init();
            context.go('/home');
          }
        },
        builder: (context, state) {
          final isLoading = state is TermsAcceptanceLoading;
          final hasError = state is TermsAcceptanceError;

          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.12),

                  // Icon
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFDEEE6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.verified_user_outlined,
                      color: AppColors.accent,
                      size: 32,
                    ),
                  )
                      .animate(delay: baseDelay)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 20),

                  // Title
                  Text(
                    'Antes de continuar',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                    textAlign: TextAlign.center,
                  )
                      .animate(delay: baseDelay + stagger)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 8),

                  // Subtitle
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 260),
                    child: Text(
                      'Tómate un momento para revisar los términos antes de usar Turnly.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  )
                      .animate(delay: baseDelay + stagger * 2)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 32),

                  // Legal links card
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE4E7EC)),
                    ),
                    child: Column(
                      children: [
                        _LegalTile(
                          title: 'Términos y Condiciones',
                          version: 'Versión 1.0',
                          onTap: () => _openLegal(context, LegalType.terms),
                        ),
                        const Divider(height: 1, color: Color(0xFFE4E7EC)),
                        _LegalTile(
                          title: 'Política de Privacidad',
                          version: 'Versión 1.0',
                          onTap: () => _openLegal(context, LegalType.privacy),
                        ),
                      ],
                    ),
                  )
                      .animate(delay: baseDelay + stagger * 3)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 24),

                  // Checkbox row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        label:
                            'Acepto los Términos y Condiciones y Política de Privacidad',
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: Checkbox(
                            value: _checked,
                            activeColor: AppColors.accent,
                            onChanged: isLoading
                                ? null
                                : (v) =>
                                    setState(() => _checked = v ?? false),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            'He leído y acepto los Términos y Condiciones y la Política de Privacidad',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                          ),
                        ),
                      ),
                    ],
                  )
                      .animate(delay: baseDelay + stagger * 4)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut),

                  const Spacer(),

                  // Error message
                  if (hasError)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          'No se pudo registrar tu aceptación. Intenta de nuevo.',
                          style: const TextStyle(
                            color: AppColors.error,
                            fontSize: 13,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),

                  // CTA
                  Semantics(
                    label: _checked
                        ? 'Continuar'
                        : 'Continuar, deshabilitado hasta aceptar los términos',
                    excludeSemantics: true,
                    child: AppButton(
                      label: 'Continuar',
                      isLoading: isLoading,
                      onPressed:
                          (_checked && !isLoading)
                              ? () => context
                                  .read<TermsAcceptanceCubit>()
                                  .accept()
                              : null,
                    ),
                  )
                      .animate(delay: baseDelay + stagger * 5)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LegalTile extends StatelessWidget {
  final String title;
  final String version;
  final VoidCallback onTap;

  const _LegalTile({
    required this.title,
    required this.version,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        version,
        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      trailing: const Icon(
        Icons.chevron_right,
        color: AppColors.textTertiary,
        size: 20,
      ),
      onTap: onTap,
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/customer_v2
fvm flutter test test/features/terms/terms_acceptance_screen_test.dart
```

Expected: 4 tests, 4 passed.

- [ ] **Step 5: Commit**

```bash
cd apps/customer_v2
git add lib/features/terms/presentation/screens/terms_acceptance_screen.dart \
        test/features/terms/terms_acceptance_screen_test.dart
git commit -m "feat: add TermsAcceptanceScreen with stagger animations"
```

---

### Task 7: Flutter — Router + LoginScreen wiring

**Files:**
- Modify: `apps/customer_v2/lib/app/router.dart`
- Modify: `apps/customer_v2/lib/features/auth/presentation/screens/login_screen.dart`

- [ ] **Step 1: Add /accept-terms route and redirect logic to router.dart**

Open `apps/customer_v2/lib/app/router.dart`.

Add the import at the top alongside the other screen imports:

```dart
import '../features/terms/presentation/screens/terms_acceptance_screen.dart';
```

In the `redirect` function, find the section that reads the token and computes `isAuthenticated`. Add the terms check. The updated redirect block becomes:

```dart
redirect: (context, state) async {
    final loc = state.uri.toString();
    if (loc.startsWith('http://') || loc.startsWith('https://')) {
      final segments =
          state.uri.pathSegments.where((s) => s.isNotEmpty).toList();
      if (segments.isEmpty) return '/home';
      if (segments.first == 'm' &&
          segments.length == 2 &&
          segments[1].length == 64) {
        return '/login';
      }
      if (_reservedWebPaths.contains(segments.first)) return '/home';
      return '/business/${segments.first}';
    }

    final token = await SecureStorage.getToken();
    final termsAccepted = await SecureStorage.getTermsAccepted();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login' ||
        state.matchedLocation == '/register' ||
        state.matchedLocation == '/onboarding';

    String? decision;
    if (!isAuthenticated && !isAuthRoute) decision = '/login';
    if (isAuthenticated && !termsAccepted &&
        state.matchedLocation != '/accept-terms') decision = '/accept-terms';
    if (isAuthenticated && termsAccepted && isAuthRoute) decision = '/home';
    print('[Router] -> ${state.matchedLocation} auth=$isAuthenticated terms=$termsAccepted decision=${decision ?? "allow"}');
    return decision;
  },
```

Add `/accept-terms` to `_reservedWebPaths`:

```dart
const _reservedWebPaths = <String>{
  'login',
  'register',
  'verify-email',
  'forgot-password',
  'accept-terms',
  // ... rest unchanged
};
```

Add the route in the routes list, after the `/verify-email` route:

```dart
GoRoute(
  path: '/accept-terms',
  pageBuilder: (context, state) => CustomTransitionPage(
    child: const TermsAcceptanceScreen(),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final reducedMotion = MediaQuery.of(context).disableAnimations;
      if (reducedMotion) {
        return FadeTransition(opacity: animation, child: child);
      }
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 1),
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: animation,
          curve: const Cubic(0.32, 0.72, 0, 1),
        )),
        child: child,
      );
    },
    transitionDuration: const Duration(milliseconds: 320),
  ),
),
```

- [ ] **Step 2: Handle AuthTermsPending in LoginScreen**

Open `apps/customer_v2/lib/features/auth/presentation/screens/login_screen.dart`.

In the `BlocConsumer` listener (or `BlocListener` if it's separate), add a handler for `AuthTermsPending`. The listener currently handles `AuthAuthenticated`. Add after that case:

```dart
} else if (state is AuthTermsPending) {
  context.go('/accept-terms');
}
```

The full listener callback becomes:

```dart
listener: (context, state) {
  if (state is AuthAuthenticated) {
    context.go('/home');
  } else if (state is AuthTermsPending) {
    context.go('/accept-terms');
  } else if (state is AuthMagicLinkSent) {
    // existing handling — keep as-is
  }
},
```

Check the existing listener to see which states are handled and add `AuthTermsPending` without removing existing handlers.

- [ ] **Step 3: Run all Flutter tests**

```bash
cd apps/customer_v2
fvm flutter test
```

Expected: all tests pass.

- [ ] **Step 4: Build for dev to verify compilation**

```bash
cd apps/customer_v2
fvm flutter build apk --flavor dev --debug
```

Expected: builds successfully, no compile errors.

- [ ] **Step 5: Commit**

```bash
cd apps/customer_v2
git add lib/app/router.dart \
        lib/features/auth/presentation/screens/login_screen.dart
git commit -m "feat: wire /accept-terms route and AuthTermsPending navigation"
```
