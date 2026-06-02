# Account Deletion (30-Day Grace Period) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers delete their account from the Flutter app; account is auto-purged after 30 days, but logging in via magic link within that window auto-restores it.

**Architecture:** Three independent subsystems — (1) Laravel API adds a `deletion_requested_at` column, a deletion endpoint, auto-restore in magic-link verify, and a daily purge command; (2) Flutter ProfileScreen gains a danger "Eliminar cuenta" item that calls the new endpoint and logs the user out; (3) the `/support` static page is updated to reflect 30-day wording. Apple guideline 5.1.1(v) is satisfied by the in-app deletion flow.

**Tech Stack:** Laravel 13 (Pest + SQLite for tests), Flutter (BLoC/Cubit + fpdart Either), Next.js 16 (TSX).

---

## File Map

### Backend — new files
- `database/migrations/2026_05_21_000001_add_deletion_requested_at_to_users_table.php`
- `app/Infrastructure/Console/Commands/PurgePendingDeletionsCommand.php`
- `app/Infrastructure/Mail/AccountDeletionRequestedMail.php`
- `resources/views/emails/account-deletion-requested.blade.php`
- `tests/Feature/Auth/AccountDeletionTest.php`

### Backend — modified files
- `app/Infrastructure/Persistence/Models/UserModel.php` — add `deletion_requested_at` to `$fillable` + casts
- `app/Infrastructure/Http/Controllers/Auth/AuthController.php` — add `requestDeletion()` method
- `app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php` — auto-restore in `verify()`
- `routes/api.php` — register `DELETE auth/account`
- `routes/console.php` — register `accounts:purge-deletions` daily

### Flutter — modified files
- `lib/features/auth/domain/entities/user.dart` — add `deletionRequestedAt: DateTime?`
- `lib/features/auth/data/dtos/auth_dto.dart` — parse `deletion_requested_at` + `account_restored`
- `lib/features/auth/domain/repositories/auth_repository.dart` — add `requestAccountDeletion()`
- `lib/features/auth/data/repositories/auth_repository_impl.dart` — implement `requestAccountDeletion()` + handle `account_restored` in `signInWithEmailLink`
- `lib/features/auth/presentation/cubit/auth_cubit.dart` — add `requestAccountDeletion()`
- `lib/features/profile/presentation/screens/profile_screen.dart` — add "Eliminar cuenta" item

### Next.js — modified files
- `apps/admin-v2/src/presentation/app/(public)/support/page.tsx` — update "7 días hábiles" → "30 días"

---

## Task 1: Migration — add `deletion_requested_at` to users

**Files:**
- Create: `apps/backend/database/migrations/2026_05_21_000001_add_deletion_requested_at_to_users_table.php`

- [ ] **Step 1: Create migration file**

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
            $table->timestamp('deletion_requested_at')->nullable()->after('terms_version_accepted');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('deletion_requested_at');
        });
    }
};
```

- [ ] **Step 2: Run migration**

```bash
cd apps/backend && php artisan migrate
```

Expected output: `Migrating: 2026_05_21_000001_add_deletion_requested_at_to_users_table` then `Migrated`.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_05_21_000001_add_deletion_requested_at_to_users_table.php
git commit -m "feat(backend): add deletion_requested_at column to users"
```

---

## Task 2: UserModel — add column to fillable and casts

**Files:**
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/UserModel.php`

- [ ] **Step 1: Add to `$fillable`**

In `UserModel.php`, change:
```php
protected $fillable = [
    'name', 'email', 'password', 'phone',
    'terms_accepted_at', 'terms_version_accepted',
];
```
To:
```php
protected $fillable = [
    'name', 'email', 'password', 'phone',
    'terms_accepted_at', 'terms_version_accepted',
    'deletion_requested_at',
];
```

- [ ] **Step 2: Add to casts**

In the `casts()` method, add:
```php
'deletion_requested_at' => 'datetime',
```

So the full `casts()` method becomes:
```php
protected function casts(): array
{
    return [
        'email_verified_at' => 'datetime',
        'terms_accepted_at' => 'datetime',
        'deletion_requested_at' => 'datetime',
        'password' => 'hashed',
        'is_super_admin' => 'boolean',
    ];
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Infrastructure/Persistence/Models/UserModel.php
git commit -m "feat(backend): expose deletion_requested_at on UserModel"
```

---

## Task 3: Confirmation email mailable + blade view

**Files:**
- Create: `apps/backend/app/Infrastructure/Mail/AccountDeletionRequestedMail.php`
- Create: `apps/backend/resources/views/emails/account-deletion-requested.blade.php`

- [ ] **Step 1: Create the mailable**

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountDeletionRequestedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $name,
        public readonly string $deletesAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Solicitud de eliminación de cuenta · Turnly',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.account-deletion-requested',
            with: [
                'name' => $this->name,
                'deletesAt' => $this->deletesAt,
            ],
        );
    }
}
```

- [ ] **Step 2: Create the blade view**

```blade
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Eliminación de cuenta</title></head>
<body style="font-family:sans-serif;color:#18181b;max-width:560px;margin:0 auto;padding:32px 16px">
  <p style="font-size:18px;font-weight:700;margin-bottom:8px">Hola, {{ $name }}</p>
  <p>Recibimos tu solicitud para eliminar tu cuenta de Turnly.</p>
  <p>Tu cuenta y datos personales se eliminarán permanentemente el <strong>{{ $deletesAt }}</strong>.</p>
  <p>Si cambias de mente, simplemente inicia sesión en la app antes de esa fecha y tu cuenta quedará restaurada automáticamente.</p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
  <p style="font-size:12px;color:#71717a">Si no reconoces esta acción, escríbenos a <a href="mailto:soporte@turnly.app">soporte@turnly.app</a>.</p>
  <p style="font-size:12px;color:#71717a">© {{ date('Y') }} Turnly · Ibarra, Ecuador</p>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add app/Infrastructure/Mail/AccountDeletionRequestedMail.php \
        resources/views/emails/account-deletion-requested.blade.php
git commit -m "feat(backend): add account deletion confirmation email"
```

---

## Task 4: DELETE /auth/account endpoint

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/AuthController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Write failing test first**

Create `apps/backend/tests/Feature/Auth/AccountDeletionTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\UserModel;

test('authenticated user can request account deletion', function () {
    $user = UserModel::factory()->create();
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withToken($token)
        ->deleteJson('/api/v1/auth/account');

    $response->assertOk()
        ->assertJsonPath('data.deletes_at', fn ($v) => $v !== null);

    $user->refresh();
    expect($user->deletion_requested_at)->not->toBeNull();
    // All tokens revoked
    expect($user->tokens()->count())->toBe(0);
});

test('unauthenticated request to delete account returns 401', function () {
    $response = $this->deleteJson('/api/v1/auth/account');
    $response->assertStatus(401);
});
```

- [ ] **Step 2: Run test — expect FAIL (route not yet registered)**

```bash
cd apps/backend && php artisan test --filter=AccountDeletionTest
```

Expected: FAIL — `Route [DELETE /api/v1/auth/account] not found`.

- [ ] **Step 3: Add `requestDeletion` method to AuthController**

Add at the end of `AuthController`, before the closing `}`:

```php
public function requestDeletion(Request $request): JsonResponse
{
    $user = $request->user();
    $deletesAt = now()->addDays(30);

    $user->update(['deletion_requested_at' => now()]);
    $user->tokens()->delete();

    Mail::to($user->email)->send(
        new \App\Infrastructure\Mail\AccountDeletionRequestedMail(
            name: $user->name,
            deletesAt: $deletesAt->format('d/m/Y'),
        )
    );

    return response()->json([
        'data' => [
            'deletes_at' => $deletesAt->toIso8601String(),
        ],
        'meta' => ['timestamp' => now()->toIso8601String()],
    ]);
}
```

Also add at the top of AuthController:

```php
use Illuminate\Support\Facades\Mail;
```

- [ ] **Step 4: Register route in `routes/api.php`**

Inside the `Route::middleware('auth:sanctum')->group(function () {` block, alongside the other auth routes, add:

```php
Route::delete('auth/account', [AuthController::class, 'requestDeletion']);
```

- [ ] **Step 5: Run test — expect PASS**

```bash
php artisan test --filter=AccountDeletionTest
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/Infrastructure/Http/Controllers/Auth/AuthController.php routes/api.php \
        tests/Feature/Auth/AccountDeletionTest.php
git commit -m "feat(backend): add DELETE /auth/account endpoint with 30-day grace period"
```

---

## Task 5: Magic-link verify — auto-restore on login during grace period

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php`

- [ ] **Step 1: Write failing test**

Add to `tests/Feature/Auth/AccountDeletionTest.php`:

```php
test('magic link login auto-restores account pending deletion', function () {
    $user = UserModel::factory()->create([
        'email' => 'restore@example.com',
        'deletion_requested_at' => now()->subDays(5),
        'email_verified_at' => now(),
    ]);

    // Insert a valid magic link token
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    \Illuminate\Support\Facades\DB::table('magic_link_tokens')->insert([
        'email' => 'restore@example.com',
        'token_hash' => $tokenHash,
        'expires_at' => now()->addMinutes(15),
        'request_ip' => '127.0.0.1',
        'request_user_agent' => 'test',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->postJson('/api/v1/auth/magic-link/verify', ['token' => $token]);

    $response->assertOk()
        ->assertJsonPath('data.account_restored', true);

    $user->refresh();
    expect($user->deletion_requested_at)->toBeNull();
});

test('magic link login with no pending deletion has account_restored false', function () {
    $user = UserModel::factory()->create([
        'email' => 'normal@example.com',
        'email_verified_at' => now(),
    ]);

    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    \Illuminate\Support\Facades\DB::table('magic_link_tokens')->insert([
        'email' => 'normal@example.com',
        'token_hash' => $tokenHash,
        'expires_at' => now()->addMinutes(15),
        'request_ip' => '127.0.0.1',
        'request_user_agent' => 'test',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->postJson('/api/v1/auth/magic-link/verify', ['token' => $token]);

    $response->assertOk()
        ->assertJsonPath('data.account_restored', false);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
php artisan test --filter=AccountDeletionTest
```

Expected: FAIL — `account_restored` key missing from response.

- [ ] **Step 3: Update `MagicLinkController::verify()`**

After `$user` is resolved and before creating the Sanctum token, add the auto-restore block. The full verify method after modification:

```php
public function verify(Request $request): JsonResponse
{
    $request->validate([
        'token' => 'required|string|size:64',
    ]);

    $token = (string) $request->input('token');
    $tokenHash = hash('sha256', $token);

    $row = DB::table('magic_link_tokens')
        ->where('token_hash', $tokenHash)
        ->first();

    if (!$row) {
        return $this->reject('INVALID_LINK', 'Link inválido o expirado.');
    }
    if ($row->used_at !== null) {
        return $this->reject('LINK_USED', 'Este link ya se usó. Pide uno nuevo.');
    }
    if (now()->greaterThan($row->expires_at)) {
        return $this->reject('LINK_EXPIRED', 'Link expirado. Pide uno nuevo.');
    }

    DB::table('magic_link_tokens')
        ->where('id', $row->id)
        ->update(['used_at' => now()]);

    $email = $row->email;
    $user = UserModel::where('email', $email)->first();

    if (!$user) {
        $user = UserModel::create([
            'name' => Str::before($email, '@'),
            'email' => $email,
            'password' => Hash::make(Str::random(32)),
            'email_verified_at' => now(),
        ]);
    } elseif ($user->email_verified_at === null) {
        $user->forceFill(['email_verified_at' => now()])->save();
    }

    $tenantUser = TenantUserModel::where('user_id', $user->id)
        ->where('is_active', true)
        ->with('tenant')
        ->first();
    $tenant = $tenantUser?->tenant;

    if ($tenant && $tenant->status === 'suspended' && !$user->is_super_admin) {
        return response()->json([
            'error' => [
                'code' => 'TENANT_SUSPENDED',
                'message' => 'Este negocio está suspendido. Contacta soporte.',
            ],
        ], 403);
    }

    // Auto-restore: if the user had requested account deletion, logging in
    // via magic link is treated as explicit intent to keep the account.
    $accountRestored = false;
    if ($user->deletion_requested_at !== null) {
        $user->update(['deletion_requested_at' => null]);
        $accountRestored = true;
    }

    $sanctumToken = $user->createToken('auth_token')->plainTextToken;

    return response()->json([
        'data' => [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_super_admin' => $user->is_super_admin,
                'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
            ],
            'token' => $sanctumToken,
            'account_restored' => $accountRestored,
            'tenant' => $tenant ? [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
                'name' => $tenant->name,
                'status' => $tenant->status,
            ] : null,
        ],
    ]);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
php artisan test --filter=AccountDeletionTest
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/Infrastructure/Http/Controllers/Auth/MagicLinkController.php \
        tests/Feature/Auth/AccountDeletionTest.php
git commit -m "feat(backend): auto-restore account on magic-link login during deletion grace period"
```

---

## Task 6: Purge command + scheduler

**Files:**
- Create: `apps/backend/app/Infrastructure/Console/Commands/PurgePendingDeletionsCommand.php`
- Modify: `apps/backend/routes/console.php`

- [ ] **Step 1: Write failing test**

Add to `tests/Feature/Auth/AccountDeletionTest.php`:

```php
test('purge command deletes users with deletion_requested_at older than 30 days', function () {
    $old = UserModel::factory()->create([
        'deletion_requested_at' => now()->subDays(31),
    ]);
    $recent = UserModel::factory()->create([
        'deletion_requested_at' => now()->subDays(5),
    ]);
    $normal = UserModel::factory()->create([
        'deletion_requested_at' => null,
    ]);

    $this->artisan('accounts:purge-deletions')->assertSuccessful();

    expect(UserModel::find($old->id))->toBeNull();
    expect(UserModel::find($recent->id))->not->toBeNull();
    expect(UserModel::find($normal->id))->not->toBeNull();
});
```

- [ ] **Step 2: Run test — expect FAIL (command not found)**

```bash
php artisan test --filter="purge command"
```

Expected: FAIL — `Command accounts:purge-deletions not found`.

- [ ] **Step 3: Create the command**

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgePendingDeletionsCommand extends Command
{
    protected $signature = 'accounts:purge-deletions';

    protected $description = 'Permanently delete accounts that completed their 30-day grace period';

    public function handle(): int
    {
        $cutoff = now()->subDays(30);

        $users = UserModel::whereNotNull('deletion_requested_at')
            ->where('deletion_requested_at', '<=', $cutoff)
            ->get();

        if ($users->isEmpty()) {
            $this->info('No accounts to purge.');
            return self::SUCCESS;
        }

        $count = 0;
        DB::transaction(function () use ($users, &$count) {
            foreach ($users as $user) {
                $tenantIds = DB::table('tenant_users')
                    ->where('user_id', $user->id)
                    ->pluck('tenant_id');

                $user->tokens()->delete();
                $user->delete();

                foreach ($tenantIds as $tenantId) {
                    $remaining = DB::table('tenant_users')
                        ->where('tenant_id', $tenantId)
                        ->count();
                    if ($remaining === 0) {
                        DB::table('tenants')->where('id', $tenantId)->delete();
                    }
                }

                $count++;
            }
        });

        $this->info("Purged {$count} account(s) past 30-day grace period.");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Register in console.php**

Add to `routes/console.php`:

```php
Schedule::command('accounts:purge-deletions')->daily();
```

- [ ] **Step 5: Run test — expect PASS**

```bash
php artisan test --filter=AccountDeletionTest
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
composer test
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add app/Infrastructure/Console/Commands/PurgePendingDeletionsCommand.php \
        routes/console.php \
        tests/Feature/Auth/AccountDeletionTest.php
git commit -m "feat(backend): add daily purge command for accounts past 30-day deletion grace period"
```

---

## Task 7: Flutter — User entity + DTO + repository interface

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/domain/entities/user.dart`
- Modify: `apps/customer_v2/lib/features/auth/data/dtos/auth_dto.dart`
- Modify: `apps/customer_v2/lib/features/auth/domain/repositories/auth_repository.dart`

- [ ] **Step 1: Add `deletionRequestedAt` to User entity**

In `lib/features/auth/domain/entities/user.dart`, change:

```dart
class User extends Equatable {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final bool emailVerified;
  final DateTime? termsAcceptedAt;
  final DateTime? deletionRequestedAt;  // NEW

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
    this.emailVerified = true,
    this.termsAcceptedAt,
    this.deletionRequestedAt,  // NEW
  });

  @override
  List<Object?> get props =>
      [id, name, email, phone, isSuperAdmin, emailVerified, termsAcceptedAt, deletionRequestedAt];
}
```

- [ ] **Step 2: Update UserDto to parse `deletion_requested_at`**

In `lib/features/auth/data/dtos/auth_dto.dart`, update `UserDto`:

```dart
class UserDto {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final bool emailVerified;
  final DateTime? termsAcceptedAt;
  final DateTime? deletionRequestedAt;  // NEW

  UserDto({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
    this.emailVerified = true,
    this.termsAcceptedAt,
    this.deletionRequestedAt,  // NEW
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    final rawTerms = json['terms_accepted_at'];
    final rawDeletion = json['deletion_requested_at'];  // NEW
    return UserDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      isSuperAdmin: json['is_super_admin'] as bool? ?? false,
      emailVerified: json['email_verified'] as bool? ?? true,
      termsAcceptedAt: rawTerms is String ? DateTime.tryParse(rawTerms) : null,
      deletionRequestedAt: rawDeletion is String ? DateTime.tryParse(rawDeletion) : null,  // NEW
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
    'deletion_requested_at': deletionRequestedAt?.toIso8601String(),  // NEW
  };

  User toEntity() => User(
    id: id,
    name: name,
    email: email,
    phone: phone,
    isSuperAdmin: isSuperAdmin,
    emailVerified: emailVerified,
    termsAcceptedAt: termsAcceptedAt,
    deletionRequestedAt: deletionRequestedAt,  // NEW
  );
}
```

Also update `AuthResponseDto` to parse `account_restored`:

```dart
class AuthResponseDto {
  final UserDto user;
  final String token;
  final bool accountRestored;  // NEW

  AuthResponseDto({
    required this.user,
    required this.token,
    this.accountRestored = false,  // NEW
  });

  factory AuthResponseDto.fromJson(Map<String, dynamic> json) {
    return AuthResponseDto(
      user: UserDto.fromJson(json['user'] as Map<String, dynamic>),
      token: json['token'] as String,
      accountRestored: json['account_restored'] as bool? ?? false,  // NEW
    );
  }
}
```

- [ ] **Step 3: Add `requestAccountDeletion` to AuthRepository interface**

In `lib/features/auth/domain/repositories/auth_repository.dart`, add:

```dart
Future<Either<Failure, Unit>> requestAccountDeletion();
```

- [ ] **Step 4: Build to verify no compile errors**

```bash
cd apps/customer_v2 && fvm flutter build apk --debug 2>&1 | grep -E "error:|Error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/features/auth/domain/entities/user.dart \
        lib/features/auth/data/dtos/auth_dto.dart \
        lib/features/auth/domain/repositories/auth_repository.dart
git commit -m "feat(flutter): add deletion_requested_at to User entity and DTO"
```

---

## Task 8: Flutter — AuthRepositoryImpl + AuthCubit

**Files:**
- Modify: `apps/customer_v2/lib/features/auth/data/repositories/auth_repository_impl.dart`
- Modify: `apps/customer_v2/lib/features/auth/presentation/cubit/auth_cubit.dart`

- [ ] **Step 1: Implement `requestAccountDeletion` in the repository**

Add to `AuthRepositoryImpl` in `auth_repository_impl.dart`:

```dart
@override
Future<Either<Failure, Unit>> requestAccountDeletion() async {
  try {
    await _dio.delete('/auth/account');
    await SecureStorage.clear();
    ApiClient.reset();
    return const Right(unit);
  } on DioException catch (e) {
    return Left(_extractError(e, 'No se pudo solicitar la eliminación'));
  } catch (e) {
    return Left(ServerFailure(e.toString()));
  }
}
```

Also update `signInWithEmailLink` to handle `account_restored`. Find the success branch (the `(data) async {` block) and add a one-shot storage flag:

```dart
(data) async {
  if (data.user.termsAcceptedAt == null) {
    emit(const AuthTermsPending());
  } else {
    await SecureStorage.setTermsAccepted(true);
    if (dto.accountRestored) {              // NEW — store flag for snackbar
      await SecureStorage.setAccountRestored(true);
    }
    emit(AuthAuthenticated(data.user));
    await _callInitPush();
  }
},
```

Wait — `dto` is not in scope inside the cubit. The flag needs to come from the repository return value. Change the `signInWithEmailLink` return type in the repository to pass `accountRestored` through.

In `auth_repository_impl.dart`, update `signInWithEmailLink` success path:

```dart
final dto = AuthResponseDto.fromJson(
  response.data['data'] as Map<String, dynamic>,
);
await SecureStorage.saveToken(dto.token);
await SecureStorage.saveUserData(jsonEncode(dto.user.toJson()));
if (dto.accountRestored) {
  await SecureStorage.setAccountRestored(true);
}
return Right((user: dto.user.toEntity(), token: dto.token));
```

- [ ] **Step 2: Add `setAccountRestored` / `getAndClearAccountRestored` to SecureStorage**

Find `lib/core/storage/secure_storage.dart` and add:

```dart
static const _accountRestoredKey = 'account_restored';

static Future<void> setAccountRestored(bool value) async {
  final storage = FlutterSecureStorage();
  await storage.write(key: _accountRestoredKey, value: value ? '1' : '0');
}

static Future<bool> getAndClearAccountRestored() async {
  final storage = FlutterSecureStorage();
  final val = await storage.read(key: _accountRestoredKey);
  if (val == '1') {
    await storage.delete(key: _accountRestoredKey);
    return true;
  }
  return false;
}
```

- [ ] **Step 3: Add `requestAccountDeletion()` to AuthCubit**

In `auth_cubit.dart`, add the method:

```dart
Future<void> requestAccountDeletion() async {
  emit(const AuthLoading());
  final result = await _repository.requestAccountDeletion();
  result.fold(
    (failure) => emit(AuthError(failure.message)),
    (_) => emit(const AuthUnauthenticated()),
  );
}
```

- [ ] **Step 4: Build to verify no errors**

```bash
fvm flutter build apk --debug 2>&1 | grep -E "error:|Error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/features/auth/data/repositories/auth_repository_impl.dart \
        lib/features/auth/presentation/cubit/auth_cubit.dart \
        lib/core/storage/secure_storage.dart
git commit -m "feat(flutter): implement requestAccountDeletion in repository and cubit"
```

---

## Task 9: Flutter — ProfileScreen "Eliminar cuenta" UI

**Files:**
- Modify: `apps/customer_v2/lib/features/profile/presentation/screens/profile_screen.dart`

- [ ] **Step 1: Add "Eliminar cuenta" danger card**

In `profile_screen.dart`, after the logout `SliverToBoxAdapter` (the one with `Cerrar sesion`) and before `SliverToBoxAdapter(child: SizedBox(height: 32))`, add:

```dart
const SliverToBoxAdapter(child: SizedBox(height: 16)),

// Delete account (danger zone)
SliverToBoxAdapter(
  child: Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20),
    child: Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: _ProfileMenuItem(
        icon: Icons.delete_outline_rounded,
        label: 'Eliminar cuenta',
        iconColor: AppColors.error,
        textColor: AppColors.error,
        showChevron: false,
        onTap: () => _confirmDeleteAccount(context),
      ),
    ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
  ),
),
```

- [ ] **Step 2: Add `_confirmDeleteAccount` as a top-level private function in the same file**

Add this function inside `ProfileScreen`'s `build` method scope — since `ProfileScreen` is a `StatelessWidget`, add it as a module-level private function at the bottom of the file (after `_ProfileMenuItem`):

```dart
void _confirmDeleteAccount(BuildContext context) {
  final deletesAt = DateTime.now().add(const Duration(days: 30));
  final formatted =
      '${deletesAt.day.toString().padLeft(2, '0')}/${deletesAt.month.toString().padLeft(2, '0')}/${deletesAt.year}';

  showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text(
        'Eliminar cuenta',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      ),
      content: Text(
        'Tu cuenta y datos se eliminarán permanentemente el $formatted. '
        'Puedes cancelar iniciando sesión antes de esa fecha.',
        style: const TextStyle(
          fontSize: 14,
          color: AppColors.textSecondary,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: TextButton.styleFrom(foregroundColor: AppColors.error),
          child: const Text('Eliminar mi cuenta'),
        ),
      ],
    ),
  ).then((confirmed) async {
    if (confirmed == true && context.mounted) {
      await context.read<AuthCubit>().requestAccountDeletion();
      if (context.mounted) {
        context.go('/login');
      }
    }
  });
}
```

Note: `_confirmDeleteAccount` is a top-level private function (outside any class) since `ProfileScreen` is stateless.

- [ ] **Step 3: Build and run on simulator to verify**

```bash
fvm flutter run
```

Navigate to Profile tab → verify "Eliminar cuenta" appears below "Cerrar sesión" → tap it → confirmation dialog shows with the 30-day date → tap Cancel → dialog closes, no action → tap "Eliminar mi cuenta" → app navigates to login screen.

- [ ] **Step 4: Commit**

```bash
git add lib/features/profile/presentation/screens/profile_screen.dart
git commit -m "feat(flutter): add Eliminar cuenta option to ProfileScreen with 30-day confirmation"
```

---

## Task 10: Support page — update deletion wording to 30 days

**Files:**
- Modify: `apps/admin-v2/src/presentation/app/(public)/support/page.tsx`

- [ ] **Step 1: Update the email fallback wording**

In `src/presentation/app/(public)/support/page.tsx`, find:

```tsx
asunto <strong>&ldquo;Eliminar cuenta&rdquo;</strong>. Procesamos la solicitud en 7 días
hábiles.
```

Replace with:

```tsx
asunto <strong>&ldquo;Eliminar cuenta&rdquo;</strong>. Tu cuenta quedará eliminada en un plazo máximo de 30 días.
```

- [ ] **Step 2: Update account deletion section to mention grace period**

Also update the step paragraph. Find:

```tsx
<p>Puedes eliminar tu cuenta directamente desde la app:</p>
```

And change the surrounding text of the deletion section to include the 30-day info:

```tsx
<p>
  Puedes eliminar tu cuenta directamente desde la app. Una vez solicitada,
  tu cuenta entrará en un período de gracia de <strong>30 días</strong> antes
  de eliminarse definitivamente. Puedes cancelar iniciando sesión antes de esa fecha.
</p>
```

- [ ] **Step 3: Run lint on the file**

```bash
cd apps/admin-v2 && npx eslint src/presentation/app/\(public\)/support/page.tsx
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-v2/src/presentation/app/\(public\)/support/page.tsx
git commit -m "fix(support): update account deletion wording to 30-day grace period"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| In-app "Eliminar cuenta" button | Task 9 |
| 30-day grace period | Task 1 (column) + Task 4 (purge at 30 days) |
| Option B: login shows reactivation intent (auto-restore via magic link) | Task 5 (backend) + Task 8 (Flutter stores flag) |
| Tokens revoked on deletion request | Task 4 (delete endpoint) |
| Confirmation email with deletion date | Task 3 |
| Daily purge command | Task 6 |
| Support page updated to 30 days | Task 10 |
| Apple 5.1.1(v) — in-app deletion path documented | Task 9 (Perfil → Eliminar cuenta) |

**Placeholder scan:** None found — all steps have complete code.

**Type consistency check:**
- `UserDto.toEntity()` passes `deletionRequestedAt` → `User` constructor accepts it ✓
- `AuthResponseDto.fromJson` parses `account_restored` → used in `auth_repository_impl.dart` ✓
- `requestAccountDeletion()` return type `Future<Either<Failure, Unit>>` consistent in interface and impl ✓
- `SecureStorage.setAccountRestored` / `getAndClearAccountRestored` symmetric key usage ✓

**Note on SecureStorage:** Task 8 requires reading `lib/core/storage/secure_storage.dart` before modifying it to get the exact class structure and existing key constants. Read the file before making edits.
