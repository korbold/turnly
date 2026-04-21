# Push Notifications System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FCM push notifications + in-app inbox for reservation lifecycle events across customer_v2 (Flutter) and admin-v2 (Next.js).

**Architecture:** Laravel notifications with custom FCM channel via HTTP v1 API. Device tokens stored in DB. Notifications dispatched via queued jobs triggered by reservation events. Both clients register FCM tokens on login, display in-app notification inbox, and handle foreground/background push.

**Tech Stack:** Laravel 13 + FCM HTTP v1 API + google/apiclient (already installed), Flutter firebase_messaging + flutter_local_notifications, Next.js firebase SDK + Service Worker.

**Spec:** `docs/superpowers/specs/2026-04-20-push-notifications-design.md`

---

## File Structure

### Backend — New Files

```
app/Domain/Notification/Enums/DevicePlatform.php
app/Infrastructure/Persistence/Models/DeviceTokenModel.php
app/Infrastructure/Notifications/Services/FcmService.php
app/Infrastructure/Notifications/Channels/FcmChannel.php
app/Infrastructure/Notifications/Notifications/ReservationConfirmed.php
app/Infrastructure/Notifications/Notifications/ReservationCancelled.php
app/Infrastructure/Notifications/Notifications/ReservationModified.php
app/Infrastructure/Notifications/Notifications/NewReservationForAdmin.php
app/Infrastructure/Http/Controllers/Notification/DeviceTokenController.php
app/Infrastructure/Http/Controllers/Notification/NotificationController.php
app/Infrastructure/Http/Requests/Notification/RegisterDeviceTokenRequest.php
app/Infrastructure/Http/Resources/NotificationResource.php
database/migrations/2026_04_21_000001_create_device_tokens_table.php
database/migrations/2026_04_21_000002_create_notifications_table.php
tests/Feature/Notification/DeviceTokenTest.php
tests/Feature/Notification/NotificationApiTest.php
tests/Feature/Notification/FcmChannelTest.php
```

### Backend — Modified Files

```
routes/api.php                                      — add notification & device-token routes
.env.example                                        — add FIREBASE_CREDENTIALS, FIREBASE_PROJECT_ID
config/services.php                                 — add firebase config section
```

### Customer_v2 — New Files

```
lib/features/notifications/domain/entities/app_notification.dart
lib/features/notifications/domain/repositories/notification_repository.dart
lib/features/notifications/data/dtos/notification_dto.dart
lib/features/notifications/data/repositories/notification_repository_impl.dart
lib/features/notifications/presentation/cubit/notifications_cubit.dart
lib/features/notifications/presentation/cubit/notifications_state.dart
lib/features/notifications/presentation/widgets/notification_tile.dart
lib/core/push/push_notification_service.dart
```

### Customer_v2 — Modified Files

```
pubspec.yaml                                        — add firebase_core, firebase_messaging, flutter_local_notifications
lib/main.dart                                       — init Firebase, init push service
lib/core/di/injection.dart                          — register notification repo + push service
lib/features/notifications/presentation/screens/notifications_screen.dart — replace mock with real
lib/app/router.dart                                 — no changes needed (route exists)
```

### Admin-v2 — New Files

```
src/lib/firebase/config.ts
src/domain/entities/app-notification.ts
src/domain/repositories/notification.repository.ts
src/infrastructure/api/repositories/api-notification.repository.ts
src/infrastructure/api/mappers/notification.mapper.ts
src/application/use-cases/notifications/get-notifications.use-case.ts
src/application/use-cases/notifications/mark-notification-read.use-case.ts
src/application/use-cases/notifications/mark-all-read.use-case.ts
src/application/use-cases/notifications/register-device-token.use-case.ts
src/presentation/hooks/use-notifications.ts
src/presentation/components/features/notifications/notification-bell.tsx
src/presentation/components/features/notifications/notification-dropdown.tsx
src/presentation/components/features/notifications/notification-item.tsx
src/presentation/app/(tenant)/notifications/page.tsx
public/firebase-messaging-sw.js
```

### Admin-v2 — Modified Files

```
package.json                                        — add firebase
.env.local                                          — add Firebase config vars
src/infrastructure/providers/repository.provider.tsx — add notification repo
src/presentation/components/layout/topbar.tsx        — replace Bell button with NotificationBell
```

---

## Task 1: Backend — Database Migrations

**Files:**
- Create: `apps/backend/database/migrations/2026_04_21_000001_create_device_tokens_table.php`
- Create: `apps/backend/database/migrations/2026_04_21_000002_create_notifications_table.php`
- Existing: `apps/backend/database/migrations/0001_01_01_000002_create_jobs_table.php` (already exists)

- [ ] **Step 1: Create device_tokens migration**

```php
<?php
// database/migrations/2026_04_21_000001_create_device_tokens_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable()->index();
            $table->uuid('tenant_id')->index();
            $table->enum('platform', ['android', 'ios', 'web']);
            $table->string('token', 512)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'platform']);

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
```

- [ ] **Step 2: Create notifications migration**

```php
<?php
// database/migrations/2026_04_21_000002_create_notifications_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->uuidMorphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
```

- [ ] **Step 3: Run migrations**

Run: `cd apps/backend && php artisan migrate`
Expected: Both tables created successfully. Jobs table already exists.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/database/migrations/2026_04_21_000001_create_device_tokens_table.php apps/backend/database/migrations/2026_04_21_000002_create_notifications_table.php
git commit -m "feat(backend): add device_tokens and notifications migrations"
```

---

## Task 2: Backend — DeviceToken Model + Platform Enum

**Files:**
- Create: `apps/backend/app/Domain/Notification/Enums/DevicePlatform.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/DeviceTokenModel.php`

- [ ] **Step 1: Create DevicePlatform enum**

```php
<?php

namespace App\Domain\Notification\Enums;

enum DevicePlatform: string
{
    case Android = 'android';
    case Ios = 'ios';
    case Web = 'web';
}
```

- [ ] **Step 2: Create DeviceTokenModel**

```php
<?php

namespace App\Infrastructure\Persistence\Models;

use App\Domain\Notification\Enums\DevicePlatform;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DeviceTokenModel extends Model
{
    use HasUuids;

    protected $table = 'device_tokens';

    protected $fillable = [
        'user_id',
        'tenant_id',
        'platform',
        'token',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'platform' => DevicePlatform::class,
            'is_active' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'user_id');
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/Domain/Notification/Enums/DevicePlatform.php apps/backend/app/Infrastructure/Persistence/Models/DeviceTokenModel.php
git commit -m "feat(backend): add DeviceTokenModel and DevicePlatform enum"
```

---

## Task 3: Backend — Firebase Config + FcmService

**Files:**
- Create: `apps/backend/app/Infrastructure/Notifications/Services/FcmService.php`
- Modify: `apps/backend/config/services.php`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Add Firebase config to services.php**

Add to the end of the `return` array in `config/services.php`:

```php
'firebase' => [
    'credentials' => env('FIREBASE_CREDENTIALS', storage_path('app/firebase/service-account.json')),
    'project_id' => env('FIREBASE_PROJECT_ID', 'turnly-services'),
],
```

- [ ] **Step 2: Add env vars to .env.example**

Append to `.env.example`:

```
FIREBASE_CREDENTIALS=storage/app/firebase/service-account.json
FIREBASE_PROJECT_ID=turnly-services
```

- [ ] **Step 3: Create FcmService**

```php
<?php

namespace App\Infrastructure\Notifications\Services;

use App\Infrastructure\Persistence\Models\DeviceTokenModel;
use Google\Client as GoogleClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    private ?string $accessToken = null;
    private ?int $tokenExpiresAt = null;

    public function send(string $fcmToken, array $notification, array $data = []): bool
    {
        $projectId = config('services.firebase.project_id');
        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        $message = [
            'message' => [
                'token' => $fcmToken,
                'notification' => [
                    'title' => $notification['title'],
                    'body' => $notification['body'],
                ],
                'data' => array_map('strval', $data),
            ],
        ];

        $response = Http::withToken($this->getAccessToken())
            ->post($url, $message);

        if ($response->successful()) {
            return true;
        }

        $status = $response->status();
        $error = $response->json('error.details.0.errorCode') ?? $response->json('error.status') ?? '';

        // Token is invalid or unregistered — deactivate it
        if ($status === 404 || $status === 410 || $error === 'UNREGISTERED') {
            DeviceTokenModel::where('token', $fcmToken)->update(['is_active' => false]);
            Log::info("FCM: deactivated invalid token", ['token' => substr($fcmToken, 0, 20) . '...']);
            return false;
        }

        Log::warning("FCM: send failed", [
            'status' => $status,
            'error' => $response->json('error'),
        ]);

        return false;
    }

    public function sendToMany(array $fcmTokens, array $notification, array $data = []): void
    {
        foreach ($fcmTokens as $token) {
            $this->send($token, $notification, $data);
        }
    }

    private function getAccessToken(): string
    {
        if ($this->accessToken && $this->tokenExpiresAt && time() < $this->tokenExpiresAt - 60) {
            return $this->accessToken;
        }

        $credentialsPath = config('services.firebase.credentials');

        // Resolve relative path from base_path
        if (!str_starts_with($credentialsPath, '/')) {
            $credentialsPath = base_path($credentialsPath);
        }

        $client = new GoogleClient();
        $client->setAuthConfig($credentialsPath);
        $client->addScope('https://www.googleapis.com/auth/firebase.messaging');

        $token = $client->fetchAccessTokenWithAssertion();

        $this->accessToken = $token['access_token'];
        $this->tokenExpiresAt = time() + ($token['expires_in'] ?? 3600);

        return $this->accessToken;
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/Infrastructure/Notifications/Services/FcmService.php apps/backend/config/services.php apps/backend/.env.example
git commit -m "feat(backend): add FcmService for FCM HTTP v1 API"
```

---

## Task 4: Backend — FcmChannel

**Files:**
- Create: `apps/backend/app/Infrastructure/Notifications/Channels/FcmChannel.php`

- [ ] **Step 1: Create FcmChannel**

```php
<?php

namespace App\Infrastructure\Notifications\Channels;

use App\Infrastructure\Notifications\Services\FcmService;
use App\Infrastructure\Persistence\Models\DeviceTokenModel;
use Illuminate\Notifications\Notification;

class FcmChannel
{
    public function __construct(private FcmService $fcmService) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toFcm')) {
            return;
        }

        $fcmPayload = $notification->toFcm($notifiable);
        $notificationData = $fcmPayload['notification'] ?? [];
        $data = $fcmPayload['data'] ?? [];

        $tokens = DeviceTokenModel::where('user_id', $notifiable->getKey())
            ->where('is_active', true)
            ->pluck('token')
            ->toArray();

        if (empty($tokens)) {
            return;
        }

        $this->fcmService->sendToMany($tokens, $notificationData, $data);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Infrastructure/Notifications/Channels/FcmChannel.php
git commit -m "feat(backend): add FcmChannel for Laravel notifications"
```

---

## Task 5: Backend — Notification Classes

**Files:**
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/ReservationConfirmed.php`
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/ReservationCancelled.php`
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/ReservationModified.php`
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/NewReservationForAdmin.php`

- [ ] **Step 1: Create ReservationConfirmed notification**

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationConfirmed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ReservationModel $reservation) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Reserva confirmada',
            'body' => "Tu reserva para {$this->reservation->service->name} el {$this->reservation->scheduled_at->translatedFormat('d M')} a las {$this->reservation->scheduled_at->format('H:i')} ha sido confirmada.",
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'check_circle',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => [
                'title' => $data['title'],
                'body' => $data['body'],
            ],
            'data' => $data,
        ];
    }
}
```

- [ ] **Step 2: Create ReservationCancelled notification**

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationCancelled extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private ReservationModel $reservation,
        private string $cancelledBy = 'client',
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $isClient = $notifiable->getKey() === $this->reservation->client_id;
        $reason = $this->reservation->cancel_reason;

        $body = $isClient
            ? "Tu reserva para {$this->reservation->service->name} el {$this->reservation->scheduled_at->translatedFormat('d M')} ha sido cancelada."
            : "La reserva de {$this->reservation->client->name} para {$this->reservation->service->name} ha sido cancelada.";

        if ($reason) {
            $body .= " Motivo: {$reason}";
        }

        return [
            'title' => 'Reserva cancelada',
            'body' => $body,
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'cancel',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => [
                'title' => $data['title'],
                'body' => $data['body'],
            ],
            'data' => $data,
        ];
    }
}
```

- [ ] **Step 3: Create ReservationModified notification**

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationModified extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ReservationModel $reservation) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Reserva actualizada',
            'body' => "Tu reserva para {$this->reservation->service->name} ha sido reprogramada al {$this->reservation->scheduled_at->translatedFormat('d M')} a las {$this->reservation->scheduled_at->format('H:i')}.",
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'edit_calendar',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => [
                'title' => $data['title'],
                'body' => $data['body'],
            ],
            'data' => $data,
        ];
    }
}
```

- [ ] **Step 4: Create NewReservationForAdmin notification**

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class NewReservationForAdmin extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ReservationModel $reservation) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Nueva reserva',
            'body' => "{$this->reservation->client->name} agendó {$this->reservation->service->name} para el {$this->reservation->scheduled_at->translatedFormat('d M')} a las {$this->reservation->scheduled_at->format('H:i')}.",
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'calendar_today',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => [
                'title' => $data['title'],
                'body' => $data['body'],
            ],
            'data' => $data,
        ];
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Infrastructure/Notifications/Notifications/
git commit -m "feat(backend): add 4 reservation notification classes with FCM + database channels"
```

---

## Task 6: Backend — Device Token API

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Requests/Notification/RegisterDeviceTokenRequest.php`
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Notification/DeviceTokenController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create RegisterDeviceTokenRequest**

```php
<?php

namespace App\Infrastructure\Http\Requests\Notification;

use Illuminate\Foundation\Http\FormRequest;

class RegisterDeviceTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:512'],
            'platform' => ['required', 'string', 'in:android,ios,web'],
        ];
    }

    public function messages(): array
    {
        return [
            'token.required' => 'El token del dispositivo es obligatorio.',
            'platform.required' => 'La plataforma es obligatoria.',
            'platform.in' => 'La plataforma debe ser android, ios o web.',
        ];
    }
}
```

- [ ] **Step 2: Create DeviceTokenController**

```php
<?php

namespace App\Infrastructure\Http\Controllers\Notification;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Notification\RegisterDeviceTokenRequest;
use App\Infrastructure\Persistence\Models\DeviceTokenModel;
use Illuminate\Http\JsonResponse;

class DeviceTokenController extends Controller
{
    public function store(RegisterDeviceTokenRequest $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = app()->has('current_tenant_id') ? app('current_tenant_id') : null;

        DeviceTokenModel::updateOrCreate(
            ['token' => $request->token],
            [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'platform' => $request->platform,
                'is_active' => true,
            ],
        );

        return response()->json([
            'data' => ['message' => 'Device token registered'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function destroy(string $token): JsonResponse
    {
        DeviceTokenModel::where('token', $token)
            ->where('user_id', request()->user()->id)
            ->delete();

        return response()->json([
            'data' => ['message' => 'Device token removed'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
```

- [ ] **Step 3: Add routes to api.php**

Inside the `Route::middleware('auth:sanctum')` group, BEFORE the tenant-scoped block, add:

```php
// Device tokens (no tenant middleware — tokens can be registered from client app)
Route::post('device-tokens', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'store']);
Route::delete('device-tokens/{token}', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'destroy']);
```

- [ ] **Step 4: Write test for device token registration**

Create `tests/Feature/Notification/DeviceTokenTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\TenantModel;

test('authenticated user can register device token', function () {
    $user = UserModel::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'android',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.message', 'Device token registered');

    $this->assertDatabaseHas('device_tokens', [
        'user_id' => $user->id,
        'token' => 'fcm-test-token-123',
        'platform' => 'android',
        'is_active' => true,
    ]);
});

test('registering same token updates existing record', function () {
    $user = UserModel::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'android',
    ]);

    $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'web',
    ]);

    $this->assertDatabaseCount('device_tokens', 1);
    $this->assertDatabaseHas('device_tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'web',
    ]);
});

test('authenticated user can delete device token', function () {
    $user = UserModel::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-456',
        'platform' => 'android',
    ]);

    $response = $this->actingAs($user)->deleteJson('/api/v1/device-tokens/fcm-test-token-456');

    $response->assertOk();
    $this->assertDatabaseMissing('device_tokens', ['token' => 'fcm-test-token-456']);
});

test('unauthenticated user cannot register device token', function () {
    $this->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-789',
        'platform' => 'android',
    ])->assertStatus(401);
});
```

- [ ] **Step 5: Run tests**

Run: `cd apps/backend && php artisan test tests/Feature/Notification/DeviceTokenTest.php`
Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Notification/DeviceTokenController.php apps/backend/app/Infrastructure/Http/Requests/Notification/RegisterDeviceTokenRequest.php apps/backend/routes/api.php apps/backend/tests/Feature/Notification/DeviceTokenTest.php
git commit -m "feat(backend): add device token registration API with tests"
```

---

## Task 7: Backend — Notifications API

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Notification/NotificationController.php`
- Create: `apps/backend/app/Infrastructure/Http/Resources/NotificationResource.php`
- Create: `apps/backend/tests/Feature/Notification/NotificationApiTest.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create NotificationResource**

```php
<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = $this->data;

        return [
            'id' => $this->id,
            'type' => class_basename($this->type),
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? '',
            'action_type' => $data['action_type'] ?? null,
            'action_id' => $data['action_id'] ?? null,
            'tenant_id' => $data['tenant_id'] ?? null,
            'tenant_name' => $data['tenant_name'] ?? null,
            'icon' => $data['icon'] ?? null,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    public function with(Request $request): array
    {
        return [
            'meta' => [
                'timestamp' => now()->toIso8601String(),
            ],
        ];
    }
}
```

- [ ] **Step 2: Create NotificationController**

```php
<?php

namespace App\Infrastructure\Http\Controllers\Notification;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $user->notifications();

        if ($request->has('unread') && $request->boolean('unread')) {
            $query = $user->unreadNotifications();
        }

        $notifications = $query->orderByDesc('created_at')->paginate(20);

        return NotificationResource::collection($notifications)
            ->additional([
                'meta' => [
                    'unread_count' => $user->unreadNotifications()->count(),
                    'timestamp' => now()->toIso8601String(),
                ],
            ])
            ->response();
    }

    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json([
            'data' => ['message' => 'Notification marked as read'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'data' => ['message' => 'All notifications marked as read'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
```

- [ ] **Step 3: Add notification routes to api.php**

Inside the `Route::middleware('auth:sanctum')` group, next to the device-token routes:

```php
// Notifications inbox
Route::get('notifications', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'index']);
Route::post('notifications/{id}/read', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'markAsRead']);
Route::post('notifications/read-all', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'markAllAsRead']);
```

- [ ] **Step 4: Write tests**

Create `tests/Feature/Notification/NotificationApiTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Notifications\Notifications\ReservationConfirmed;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\ServiceModel;

test('authenticated user can list notifications', function () {
    $tenant = TenantModel::factory()->create();
    $user = UserModel::factory()->create();
    $tenant->users()->attach($user, ['role' => 'client', 'is_active' => true]);
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
        'service_id' => $service->id,
        'created_by' => $user->id,
    ]);

    $user->notify(new ReservationConfirmed($reservation));

    $response = $this->actingAs($user)->getJson('/api/v1/notifications');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonStructure([
            'data' => [['id', 'type', 'title', 'body', 'action_type', 'read_at', 'created_at']],
            'meta' => ['unread_count'],
        ]);
});

test('user can mark notification as read', function () {
    $user = UserModel::factory()->create();
    $tenant = TenantModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
        'service_id' => $service->id,
        'created_by' => $user->id,
    ]);

    $user->notify(new ReservationConfirmed($reservation));
    $notification = $user->notifications()->first();

    $response = $this->actingAs($user)->postJson("/api/v1/notifications/{$notification->id}/read");

    $response->assertOk();
    $this->assertNotNull($notification->fresh()->read_at);
});

test('user can mark all notifications as read', function () {
    $user = UserModel::factory()->create();
    $tenant = TenantModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
        'service_id' => $service->id,
        'created_by' => $user->id,
    ]);

    $user->notify(new ReservationConfirmed($reservation));
    $user->notify(new ReservationConfirmed($reservation));

    $this->actingAs($user)->postJson('/api/v1/notifications/read-all')->assertOk();

    expect($user->unreadNotifications()->count())->toBe(0);
});
```

- [ ] **Step 5: Run tests**

Run: `cd apps/backend && php artisan test tests/Feature/Notification/NotificationApiTest.php`
Expected: All 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Notification/NotificationController.php apps/backend/app/Infrastructure/Http/Resources/NotificationResource.php apps/backend/routes/api.php apps/backend/tests/Feature/Notification/NotificationApiTest.php
git commit -m "feat(backend): add notifications inbox API with tests"
```

---

## Task 8: Backend — Wire Notifications into Reservation Use Cases

**Files:**
- Modify: `apps/backend/app/Application/UseCases/Reservation/CreateReservationUseCase.php`
- Modify: `apps/backend/app/Application/UseCases/Reservation/ConfirmReservationUseCase.php`
- Modify: `apps/backend/app/Application/UseCases/Reservation/CancelReservationUseCase.php`

Notification dispatch goes at the end of each use case after the persistence call succeeds. This is simpler than events+listeners for 4 notifications and avoids adding event infrastructure that doesn't exist yet.

- [ ] **Step 1: Wire notification into CreateReservationUseCase**

After the `$this->reservationRepository->save($reservation)` call, add notification to tenant admins:

```php
use App\Infrastructure\Notifications\Notifications\NewReservationForAdmin;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Facades\Notification;
```

After `return $this->reservationRepository->save($reservation);`, change to:

```php
$saved = $this->reservationRepository->save($reservation);

// Notify tenant admins about new reservation
$model = ReservationModel::with(['service', 'client', 'tenant'])->find($saved->id);
if ($model) {
    $admins = TenantModel::find($saved->tenantId)
        ?->users()
        ->wherePivotIn('role', ['owner', 'tenant_admin'])
        ->wherePivot('is_active', true)
        ->get();

    if ($admins && $admins->isNotEmpty()) {
        Notification::send($admins, new NewReservationForAdmin($model));
    }
}

return $saved;
```

- [ ] **Step 2: Wire notification into ConfirmReservationUseCase**

After the `$this->reservationRepository->updateStatus(...)` call:

```php
use App\Infrastructure\Notifications\Notifications\ReservationConfirmed;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserModel;
```

After `updateStatus` call:

```php
$this->reservationRepository->updateStatus($reservationId, ReservationStatus::Confirmed);

// Notify client
$model = ReservationModel::with(['service', 'tenant'])->find($reservationId);
$client = $model ? UserModel::find($model->client_id) : null;
if ($client && $model) {
    $client->notify(new ReservationConfirmed($model));
}
```

- [ ] **Step 3: Wire notification into CancelReservationUseCase**

After the `$this->reservationRepository->updateStatus(...)` call:

```php
use App\Infrastructure\Notifications\Notifications\ReservationCancelled;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Notification;
```

After `updateStatus` call:

```php
$this->reservationRepository->updateStatus($reservationId, ReservationStatus::Cancelled, $cancelReason);

// Notify both client and tenant admins
$model = ReservationModel::with(['service', 'client', 'tenant'])->find($reservationId);
if ($model) {
    $notification = new ReservationCancelled($model);

    // Notify client
    $client = UserModel::find($model->client_id);
    if ($client) {
        $client->notify($notification);
    }

    // Notify tenant admins
    $admins = TenantModel::find($model->tenant_id)
        ?->users()
        ->wherePivotIn('role', ['owner', 'tenant_admin'])
        ->wherePivot('is_active', true)
        ->where('users.id', '!=', $model->client_id)
        ->get();

    if ($admins && $admins->isNotEmpty()) {
        Notification::send($admins, $notification);
    }
}
```

- [ ] **Step 4: Run all tests**

Run: `cd apps/backend && php artisan test`
Expected: All existing tests still pass. Notifications are queued so they don't block use case execution.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Application/UseCases/Reservation/
git commit -m "feat(backend): dispatch notifications from reservation use cases"
```

---

## Task 9: Backend — Queue Configuration

**Files:**
- Modify: `apps/backend/.env` (local)
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Update .env.example with queue config**

Change in `.env.example`:

```
QUEUE_CONNECTION=database
```

- [ ] **Step 2: Update local .env**

Change `QUEUE_CONNECTION=sync` to `QUEUE_CONNECTION=database` in `.env`.

- [ ] **Step 3: Verify jobs table exists**

Run: `cd apps/backend && php artisan migrate:status | grep jobs`
Expected: The `create_jobs_table` migration shows as "Ran".

- [ ] **Step 4: Commit**

```bash
git add apps/backend/.env.example
git commit -m "feat(backend): configure database queue driver for async notifications"
```

---

## Task 10: Customer_v2 — Push Notification Service

**Files:**
- Create: `apps/customer_v2/lib/core/push/push_notification_service.dart`
- Modify: `apps/customer_v2/pubspec.yaml`
- Modify: `apps/customer_v2/lib/main.dart`
- Modify: `apps/customer_v2/lib/core/di/injection.dart`

- [ ] **Step 1: Add dependencies to pubspec.yaml**

Add under `dependencies:`:

```yaml
  firebase_core: ^3.8.1
  firebase_messaging: ^15.1.6
  flutter_local_notifications: ^18.0.0
```

- [ ] **Step 2: Run flutter pub get**

Run: `cd apps/customer_v2 && flutter pub get`
Expected: Dependencies resolve successfully.

- [ ] **Step 3: Create PushNotificationService**

```dart
// lib/core/push/push_notification_service.dart
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background messages handled by system tray automatically
}

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Dio _dio = ApiClient.instance;

  Future<void> init() async {
    // Request permission
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Setup local notifications for foreground
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _localNotifications.initialize(initSettings);

    // Background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Register token
    final token = await _messaging.getToken();
    if (token != null) {
      await _registerToken(token);
    }

    // Token refresh
    _messaging.onTokenRefresh.listen(_registerToken);
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'turnly_notifications',
          'Turnly Notifications',
          channelDescription: 'Notifications from Turnly',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );
  }

  Future<void> _registerToken(String token) async {
    try {
      await _dio.post('/device-tokens', data: {
        'token': token,
        'platform': 'android',
      });
    } catch (_) {
      // Silently fail — token will be re-registered on next app start
    }
  }
}
```

- [ ] **Step 4: Update main.dart**

Add Firebase initialization:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'core/push/push_notification_service.dart';
```

In the `main()` function, after `WidgetsFlutterBinding.ensureInitialized();`:

```dart
  // Init Firebase
  await Firebase.initializeApp();
```

After `configureDependencies();`:

```dart
  // Init push notifications (after DI so ApiClient is available)
  final pushService = PushNotificationService();
  getIt.registerSingleton<PushNotificationService>(pushService);
```

After `runApp(...)`, the push init should be called after auth is checked. Instead, add a post-frame callback approach. Actually, better: init push lazily after login. Add to `main()` before `runApp`:

```dart
  // Push notifications will be initialized after login via AuthCubit
```

Actually, simpler approach: init Firebase in main, but defer push token registration until user is authenticated. Update `PushNotificationService.init()` to be called from login flow.

Revised main.dart additions after `WidgetsFlutterBinding.ensureInitialized();`:

```dart
  // Init Firebase
  await Firebase.initializeApp();
```

Register service in DI but don't call init() yet:

```dart
  getIt.registerLazySingleton<PushNotificationService>(() => PushNotificationService());
```

- [ ] **Step 5: Register in DI**

In `lib/core/di/injection.dart`, add import and registration:

```dart
import '../push/push_notification_service.dart';
```

Add to `configureDependencies()`:

```dart
  // Push
  getIt.registerLazySingleton<PushNotificationService>(() => PushNotificationService());
```

Note: Remove the duplicate registration from main.dart if added there — only register in injection.dart.

- [ ] **Step 6: Initialize push after login**

In `lib/features/auth/presentation/cubit/auth_cubit.dart`, after successful login/checkAuth where user is confirmed authenticated, call:

```dart
import '../../../../core/di/injection.dart';
import '../../../../core/push/push_notification_service.dart';

// After emitting AuthAuthenticated state:
getIt<PushNotificationService>().init();
```

- [ ] **Step 7: Commit**

```bash
git add apps/customer_v2/pubspec.yaml apps/customer_v2/lib/core/push/ apps/customer_v2/lib/main.dart apps/customer_v2/lib/core/di/injection.dart apps/customer_v2/lib/features/auth/presentation/cubit/auth_cubit.dart
git commit -m "feat(customer_v2): add Firebase push notification service with token registration"
```

---

## Task 11: Customer_v2 — Notification Feature (Domain + Data)

**Files:**
- Create: `apps/customer_v2/lib/features/notifications/domain/entities/app_notification.dart`
- Create: `apps/customer_v2/lib/features/notifications/domain/repositories/notification_repository.dart`
- Create: `apps/customer_v2/lib/features/notifications/data/dtos/notification_dto.dart`
- Create: `apps/customer_v2/lib/features/notifications/data/repositories/notification_repository_impl.dart`

- [ ] **Step 1: Create AppNotification entity**

```dart
// lib/features/notifications/domain/entities/app_notification.dart
import 'package:equatable/equatable.dart';

class AppNotification extends Equatable {
  final String id;
  final String type;
  final String title;
  final String body;
  final String? actionType;
  final String? actionId;
  final String? tenantId;
  final String? tenantName;
  final String? icon;
  final DateTime? readAt;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.actionType,
    this.actionId,
    this.tenantId,
    this.tenantName,
    this.icon,
    this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 2: Create NotificationRepository interface**

```dart
// lib/features/notifications/domain/repositories/notification_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/app_notification.dart';

abstract class NotificationRepository {
  Future<Either<Failure, List<AppNotification>>> getAll({bool unreadOnly});
  Future<Either<Failure, int>> getUnreadCount();
  Future<Either<Failure, Unit>> markAsRead(String id);
  Future<Either<Failure, Unit>> markAllAsRead();
}
```

- [ ] **Step 3: Create NotificationDto**

```dart
// lib/features/notifications/data/dtos/notification_dto.dart
import '../../domain/entities/app_notification.dart';

class NotificationDto {
  final Map<String, dynamic> json;

  NotificationDto(this.json);

  AppNotification toEntity() {
    return AppNotification(
      id: json['id'] as String,
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      actionType: json['action_type'] as String?,
      actionId: json['action_id'] as String?,
      tenantId: json['tenant_id'] as String?,
      tenantName: json['tenant_name'] as String?,
      icon: json['icon'] as String?,
      readAt: json['read_at'] != null
          ? DateTime.parse(json['read_at'] as String).toLocal()
          : null,
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
    );
  }
}
```

- [ ] **Step 4: Create NotificationRepositoryImpl**

```dart
// lib/features/notifications/data/repositories/notification_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../dtos/notification_dto.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/repositories/notification_repository.dart';

class NotificationRepositoryImpl implements NotificationRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<AppNotification>>> getAll({bool unreadOnly = false}) async {
    try {
      final params = <String, dynamic>{};
      if (unreadOnly) params['unread'] = true;

      final response = await _dio.get('/notifications', queryParameters: params);
      final data = response.data['data'] as List<dynamic>;
      final notifications = data
          .map((e) => NotificationDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(notifications);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener notificaciones',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, int>> getUnreadCount() async {
    try {
      final response = await _dio.get('/notifications', queryParameters: {'unread': true});
      final count = response.data['meta']?['unread_count'] as int? ?? 0;
      return Right(count);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(e.toString()));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> markAsRead(String id) async {
    try {
      await _dio.post('/notifications/$id/read');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al marcar notificación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> markAllAsRead() async {
    try {
      await _dio.post('/notifications/read-all');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al marcar notificaciones',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
```

- [ ] **Step 5: Register in DI**

In `lib/core/di/injection.dart`:

```dart
import '../../features/notifications/domain/repositories/notification_repository.dart';
import '../../features/notifications/data/repositories/notification_repository_impl.dart';
```

Add to `configureDependencies()`:

```dart
  // Notifications
  getIt.registerLazySingleton<NotificationRepository>(() => NotificationRepositoryImpl());
```

- [ ] **Step 6: Commit**

```bash
git add apps/customer_v2/lib/features/notifications/domain/ apps/customer_v2/lib/features/notifications/data/ apps/customer_v2/lib/core/di/injection.dart
git commit -m "feat(customer_v2): add notification domain, DTOs, and repository"
```

---

## Task 12: Customer_v2 — Notifications UI (Cubit + Screen)

**Files:**
- Create: `apps/customer_v2/lib/features/notifications/presentation/cubit/notifications_cubit.dart`
- Create: `apps/customer_v2/lib/features/notifications/presentation/cubit/notifications_state.dart`
- Create: `apps/customer_v2/lib/features/notifications/presentation/widgets/notification_tile.dart`
- Modify: `apps/customer_v2/lib/features/notifications/presentation/screens/notifications_screen.dart`

- [ ] **Step 1: Create NotificationsState**

```dart
// lib/features/notifications/presentation/cubit/notifications_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/app_notification.dart';

sealed class NotificationsState extends Equatable {
  const NotificationsState();

  @override
  List<Object?> get props => [];
}

class NotificationsInitial extends NotificationsState {
  const NotificationsInitial();
}

class NotificationsLoading extends NotificationsState {
  const NotificationsLoading();
}

class NotificationsLoaded extends NotificationsState {
  final List<AppNotification> notifications;
  final int unreadCount;

  const NotificationsLoaded(this.notifications, {this.unreadCount = 0});

  @override
  List<Object?> get props => [notifications, unreadCount];
}

class NotificationsError extends NotificationsState {
  final String message;

  const NotificationsError(this.message);

  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 2: Create NotificationsCubit**

```dart
// lib/features/notifications/presentation/cubit/notifications_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/notification_repository.dart';
import 'notifications_state.dart';

class NotificationsCubit extends Cubit<NotificationsState> {
  final NotificationRepository _repository;

  NotificationsCubit(this._repository) : super(const NotificationsInitial());

  Future<void> loadNotifications() async {
    emit(const NotificationsLoading());
    final result = await _repository.getAll();
    result.fold(
      (failure) => emit(NotificationsError(failure.message)),
      (notifications) {
        final unreadCount = notifications.where((n) => !n.isRead).length;
        emit(NotificationsLoaded(notifications, unreadCount: unreadCount));
      },
    );
  }

  Future<void> markAsRead(String id) async {
    final result = await _repository.markAsRead(id);
    result.fold(
      (_) {},
      (_) => loadNotifications(),
    );
  }

  Future<void> markAllAsRead() async {
    final result = await _repository.markAllAsRead();
    result.fold(
      (_) {},
      (_) => loadNotifications(),
    );
  }
}
```

- [ ] **Step 3: Create NotificationTile widget**

```dart
// lib/features/notifications/presentation/widgets/notification_tile.dart
import 'package:flutter/material.dart';
import '../../../../app/theme/app_colors.dart';
import '../../domain/entities/app_notification.dart';
import 'package:intl/intl.dart';

class NotificationTile extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback? onTap;

  const NotificationTile({
    super.key,
    required this.notification,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = _iconColor;
    final timeAgo = _formatTimeAgo(notification.createdAt);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: notification.isRead ? AppColors.surface : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: notification.isRead ? AppColors.border : AppColors.accent.withValues(alpha: 0.3),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: notification.isRead ? Colors.transparent : color,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(_iconData, color: color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    notification.title,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: notification.isRead ? FontWeight.w500 : FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                                Text(
                                  timeAgo,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textTertiary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              notification.body,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color get _iconColor {
    return switch (notification.icon) {
      'check_circle' => AppColors.success,
      'cancel' => const Color(0xFFEF4444),
      'edit_calendar' => AppColors.warning,
      'calendar_today' => AppColors.info,
      _ => AppColors.accent,
    };
  }

  IconData get _iconData {
    return switch (notification.icon) {
      'check_circle' => Icons.check_circle_rounded,
      'cancel' => Icons.cancel_rounded,
      'edit_calendar' => Icons.edit_calendar_rounded,
      'calendar_today' => Icons.calendar_today_rounded,
      _ => Icons.notifications_rounded,
    };
  }

  String _formatTimeAgo(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 1) return 'Ahora';
    if (diff.inMinutes < 60) return 'Hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'Hace ${diff.inHours}h';
    if (diff.inDays < 7) return 'Hace ${diff.inDays}d';
    return DateFormat('d MMM', 'es').format(date);
  }
}
```

- [ ] **Step 4: Replace notifications_screen.dart**

```dart
// lib/features/notifications/presentation/screens/notifications_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../domain/repositories/notification_repository.dart';
import '../cubit/notifications_cubit.dart';
import '../cubit/notifications_state.dart';
import '../widgets/notification_tile.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => NotificationsCubit(getIt<NotificationRepository>())..loadNotifications(),
      child: const _NotificationsView(),
    );
  }
}

class _NotificationsView extends StatelessWidget {
  const _NotificationsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          BlocBuilder<NotificationsCubit, NotificationsState>(
            builder: (context, state) {
              if (state is NotificationsLoaded && state.unreadCount > 0) {
                return TextButton(
                  onPressed: () => context.read<NotificationsCubit>().markAllAsRead(),
                  child: const Text('Marcar todas'),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: BlocBuilder<NotificationsCubit, NotificationsState>(
        builder: (context, state) {
          if (state is NotificationsLoading || state is NotificationsInitial) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is NotificationsError) {
            return EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Error al cargar notificaciones',
              subtitle: state.message,
              actionLabel: 'Reintentar',
              onAction: () => context.read<NotificationsCubit>().loadNotifications(),
            );
          }

          if (state is NotificationsLoaded) {
            if (state.notifications.isEmpty) {
              return const EmptyState(
                icon: Icons.notifications_off_rounded,
                title: 'Sin notificaciones',
                subtitle: 'Cuando recibas notificaciones, aparecerán aquí.',
              );
            }

            return RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                context.read<NotificationsCubit>().loadNotifications();
              },
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.all(20),
                itemCount: state.notifications.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final notification = state.notifications[index];
                  return NotificationTile(
                    notification: notification,
                    onTap: () {
                      if (!notification.isRead) {
                        context.read<NotificationsCubit>().markAsRead(notification.id);
                      }
                      if (notification.actionType == 'reservation_detail' &&
                          notification.actionId != null) {
                        context.push('/reservations/${notification.actionId}');
                      }
                    },
                  )
                      .animate()
                      .fadeIn(duration: 350.ms, delay: (60 * index).ms)
                      .slideX(begin: 0.03, end: 0);
                },
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/customer_v2/lib/features/notifications/
git commit -m "feat(customer_v2): notifications cubit, tile widget, and real screen replacing mock"
```

---

## Task 13: Admin-v2 — Firebase Setup + Service Worker

**Files:**
- Create: `apps/admin-v2/src/lib/firebase/config.ts`
- Create: `apps/admin-v2/public/firebase-messaging-sw.js`
- Modify: `apps/admin-v2/package.json` (add firebase)
- Modify: `apps/admin-v2/.env.local`

- [ ] **Step 1: Install firebase**

Run: `cd apps/admin-v2 && npm install firebase`

- [ ] **Step 2: Add env vars to .env.local**

Append to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=turnly-services.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=turnly-services
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=turnly-services.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=624883049252
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Note: `API_KEY`, `APP_ID`, and `VAPID_KEY` must be filled after registering web app in Firebase Console.

- [ ] **Step 3: Create Firebase config**

```typescript
// src/lib/firebase/config.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0];
}

let messaging: Messaging | null = null;

function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  if (!messaging) {
    messaging = getMessaging(getFirebaseApp());
  }
  return messaging;
}

export async function requestPushToken(): Promise<string | null> {
  try {
    const m = getFirebaseMessaging();
    if (!m) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(m, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    return token;
  } catch {
    return null;
  }
}

export function onForegroundMessage(callback: (payload: { title?: string; body?: string }) => void) {
  const m = getFirebaseMessaging();
  if (!m) return () => {};

  return onMessage(m, (payload) => {
    callback({
      title: payload.notification?.title,
      body: payload.notification?.body,
    });
  });
}
```

- [ ] **Step 4: Create Service Worker**

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY,
  authDomain: self.__FIREBASE_AUTH_DOMAIN,
  projectId: self.__FIREBASE_PROJECT_ID,
  storageBucket: self.__FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID,
  appId: self.__FIREBASE_APP_ID,
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Turnly';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/dashboard';

  if (data?.action_type === 'reservation_detail' && data?.action_id) {
    url = `/reservations`;
  }

  event.waitUntil(clients.openWindow(url));
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/lib/firebase/ apps/admin-v2/public/firebase-messaging-sw.js apps/admin-v2/package.json apps/admin-v2/package-lock.json
git commit -m "feat(admin-v2): add Firebase config and service worker for web push"
```

---

## Task 14: Admin-v2 — Notification Domain + Infrastructure

**Files:**
- Create: `apps/admin-v2/src/domain/entities/app-notification.ts`
- Create: `apps/admin-v2/src/domain/repositories/notification.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/notification.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-notification.repository.ts`
- Create: `apps/admin-v2/src/application/use-cases/notifications/get-notifications.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/notifications/mark-notification-read.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/notifications/mark-all-read.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/notifications/register-device-token.use-case.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-notifications.ts`
- Modify: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`

- [ ] **Step 1: Create entity**

```typescript
// src/domain/entities/app-notification.ts
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionType: string | null;
  actionId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  icon: string | null;
  readAt: Date | null;
  createdAt: Date;
}
```

- [ ] **Step 2: Create repository interface**

```typescript
// src/domain/repositories/notification.repository.ts
import type { AppNotification } from '../entities/app-notification';

export interface NotificationRepository {
  getAll(unreadOnly?: boolean): Promise<{ notifications: AppNotification[]; unreadCount: number }>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  registerDeviceToken(token: string, platform: string): Promise<void>;
  removeDeviceToken(token: string): Promise<void>;
}
```

- [ ] **Step 3: Create mapper**

```typescript
// src/infrastructure/api/mappers/notification.mapper.ts
import type { AppNotification } from '@/domain/entities/app-notification';

export function mapNotification(raw: Record<string, unknown>): AppNotification {
  return {
    id: raw.id as string,
    type: raw.type as string,
    title: raw.title as string,
    body: raw.body as string,
    actionType: (raw.action_type as string) ?? null,
    actionId: (raw.action_id as string) ?? null,
    tenantId: (raw.tenant_id as string) ?? null,
    tenantName: (raw.tenant_name as string) ?? null,
    icon: (raw.icon as string) ?? null,
    readAt: raw.read_at ? new Date(raw.read_at as string) : null,
    createdAt: new Date(raw.created_at as string),
  };
}
```

- [ ] **Step 4: Create API repository**

```typescript
// src/infrastructure/api/repositories/api-notification.repository.ts
import type { NotificationRepository } from '@/domain/repositories/notification.repository';
import type { AppNotification } from '@/domain/entities/app-notification';
import api from '../client';
import { mapNotification } from '../mappers/notification.mapper';

export class ApiNotificationRepository implements NotificationRepository {
  async getAll(unreadOnly = false): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    const params: Record<string, unknown> = {};
    if (unreadOnly) params.unread = true;

    const { data: res } = await api.get('/notifications', { params });
    const notifications = (res.data as Record<string, unknown>[]).map(mapNotification);
    const unreadCount = (res.meta?.unread_count as number) ?? 0;

    return { notifications, unreadCount };
  }

  async markAsRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`);
  }

  async markAllAsRead(): Promise<void> {
    await api.post('/notifications/read-all');
  }

  async registerDeviceToken(token: string, platform: string): Promise<void> {
    await api.post('/device-tokens', { token, platform });
  }

  async removeDeviceToken(token: string): Promise<void> {
    await api.delete(`/device-tokens/${token}`);
  }
}
```

- [ ] **Step 5: Create use cases**

```typescript
// src/application/use-cases/notifications/get-notifications.use-case.ts
import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class GetNotificationsUseCase {
  constructor(private repo: NotificationRepository) {}
  execute(unreadOnly?: boolean) {
    return this.repo.getAll(unreadOnly);
  }
}
```

```typescript
// src/application/use-cases/notifications/mark-notification-read.use-case.ts
import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class MarkNotificationReadUseCase {
  constructor(private repo: NotificationRepository) {}
  execute(id: string) {
    return this.repo.markAsRead(id);
  }
}
```

```typescript
// src/application/use-cases/notifications/mark-all-read.use-case.ts
import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class MarkAllReadUseCase {
  constructor(private repo: NotificationRepository) {}
  execute() {
    return this.repo.markAllAsRead();
  }
}
```

```typescript
// src/application/use-cases/notifications/register-device-token.use-case.ts
import type { NotificationRepository } from '@/domain/repositories/notification.repository';

export class RegisterDeviceTokenUseCase {
  constructor(private repo: NotificationRepository) {}
  execute(token: string, platform: string) {
    return this.repo.registerDeviceToken(token, platform);
  }
}
```

- [ ] **Step 6: Create hooks**

```typescript
// src/presentation/hooks/use-notifications.ts
'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetNotificationsUseCase } from '@/application/use-cases/notifications/get-notifications.use-case';
import { MarkNotificationReadUseCase } from '@/application/use-cases/notifications/mark-notification-read.use-case';
import { MarkAllReadUseCase } from '@/application/use-cases/notifications/mark-all-read.use-case';
import { RegisterDeviceTokenUseCase } from '@/application/use-cases/notifications/register-device-token.use-case';
import { requestPushToken, onForegroundMessage } from '@/lib/firebase/config';
import { toast } from 'sonner';

export function useNotifications() {
  const repo = useRepository('notification');
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => new GetNotificationsUseCase(repo).execute(),
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}

export function useMarkNotificationRead() {
  const repo = useRepository('notification');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new MarkNotificationReadUseCase(repo).execute(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const repo = useRepository('notification');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => new MarkAllReadUseCase(repo).execute(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useRegisterPushToken() {
  const repo = useRepository('notification');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function setup() {
      const token = await requestPushToken();
      if (token) {
        await new RegisterDeviceTokenUseCase(repo).execute(token, 'web');
      }

      unsubscribe = onForegroundMessage((payload) => {
        if (payload.title) {
          toast(payload.title, { description: payload.body });
        }
      });
    }

    setup();
    return () => unsubscribe?.();
  }, [repo]);
}
```

- [ ] **Step 7: Add notification repository to provider**

In `src/infrastructure/providers/repository.provider.tsx`:

Add import:
```typescript
import type { NotificationRepository } from '@/domain/repositories/notification.repository';
import { ApiNotificationRepository } from '../api/repositories/api-notification.repository';
```

Add to `Repositories` interface:
```typescript
notification: NotificationRepository;
```

Add to `useMemo` object:
```typescript
notification: new ApiNotificationRepository(),
```

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/src/domain/entities/app-notification.ts apps/admin-v2/src/domain/repositories/notification.repository.ts apps/admin-v2/src/infrastructure/api/mappers/notification.mapper.ts apps/admin-v2/src/infrastructure/api/repositories/api-notification.repository.ts apps/admin-v2/src/application/use-cases/notifications/ apps/admin-v2/src/presentation/hooks/use-notifications.ts apps/admin-v2/src/infrastructure/providers/repository.provider.tsx
git commit -m "feat(admin-v2): add notification domain, repository, use cases, and hooks"
```

---

## Task 15: Admin-v2 — Notification Bell + Dropdown + Page

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/notifications/notification-bell.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/notifications/notification-dropdown.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/notifications/notification-item.tsx`
- Create: `apps/admin-v2/src/presentation/app/(tenant)/notifications/page.tsx`
- Modify: `apps/admin-v2/src/presentation/components/layout/topbar.tsx`

- [ ] **Step 1: Create notification-item.tsx**

```tsx
// src/presentation/components/features/notifications/notification-item.tsx
'use client';

import type { AppNotification } from '@/domain/entities/app-notification';
import { cn } from '@/shared/utils/cn';
import {
  CalendarCheck,
  CalendarX,
  CalendarClock,
  CalendarPlus,
  BellRing,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItemProps {
  notification: AppNotification;
  onClick?: () => void;
}

const ICON_MAP: Record<string, { icon: typeof BellRing; color: string; bg: string }> = {
  check_circle: { icon: CalendarCheck, color: 'text-green-600', bg: 'bg-green-50' },
  cancel: { icon: CalendarX, color: 'text-red-600', bg: 'bg-red-50' },
  edit_calendar: { icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50' },
  calendar_today: { icon: CalendarPlus, color: 'text-indigo-600', bg: 'bg-indigo-50' },
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const iconConfig = ICON_MAP[notification.icon ?? ''] ?? {
    icon: BellRing,
    color: 'text-zinc-600',
    bg: 'bg-zinc-50',
  };
  const Icon = iconConfig.icon;

  const timeAgo = formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es });

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-zinc-50',
        !notification.readAt && 'bg-indigo-50/50',
      )}
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconConfig.bg)}>
        <Icon className={cn('h-4 w-4', iconConfig.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', !notification.readAt ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700')}>
            {notification.title}
          </p>
          {!notification.readAt && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{notification.body}</p>
        <p className="mt-1 text-xs text-zinc-400">{timeAgo}</p>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create notification-dropdown.tsx**

```tsx
// src/presentation/components/features/notifications/notification-dropdown.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '@/presentation/hooks/use-notifications';
import { NotificationItem } from './notification-item';
import { Button } from '@/presentation/components/ui/button';
import { Separator } from '@/presentation/components/ui/separator';

export function NotificationDropdown() {
  const router = useRouter();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.notifications.slice(0, 8) ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleClick = (notification: typeof notifications[number]) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    if (notification.actionType === 'reservation_detail') {
      router.push('/reservations');
    }
  };

  return (
    <div className="w-96">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Notificaciones</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-auto py-1 text-xs" onClick={() => markAll.mutate()}>
            Marcar todas
          </Button>
        )}
      </div>
      <Separator />
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">Sin notificaciones</p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
          ))
        )}
      </div>
      {notifications.length > 0 && (
        <>
          <Separator />
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-zinc-500"
              onClick={() => router.push('/notifications')}
            >
              Ver todas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create notification-bell.tsx**

```tsx
// src/presentation/components/features/notifications/notification-bell.tsx
'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import { useUnreadCount, useRegisterPushToken } from '@/presentation/hooks/use-notifications';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  useRegisterPushToken();
  const unreadCount = useUnreadCount();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-zinc-500 hover:text-zinc-700">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <NotificationDropdown />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Create notifications page**

```tsx
// src/presentation/app/(tenant)/notifications/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '@/presentation/hooks/use-notifications';
import { NotificationItem } from '@/presentation/components/features/notifications/notification-item';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

export default function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleClick = (notification: typeof notifications[number]) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    if (notification.actionType === 'reservation_detail') {
      router.push('/reservations');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notificaciones</CardTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
              Marcar todas como leídas
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-400">Sin notificaciones</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Update topbar.tsx — replace Bell button with NotificationBell**

Replace the existing Bell button in `topbar.tsx`:

Old:
```tsx
<Button
  variant="ghost"
  size="icon"
  className="relative text-zinc-500 hover:text-zinc-700"
>
  <Bell className="h-5 w-5" />
  <span className="sr-only">Notificaciones</span>
</Button>
```

New:
```tsx
<NotificationBell />
```

Add import at top:
```tsx
import { NotificationBell } from '@/presentation/components/features/notifications/notification-bell';
```

Remove unused `Bell` import from lucide-react (keep `LogOut` and `User`).

- [ ] **Step 6: Verify build**

Run: `cd apps/admin-v2 && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/notifications/ apps/admin-v2/src/presentation/app/\(tenant\)/notifications/ apps/admin-v2/src/presentation/components/layout/topbar.tsx
git commit -m "feat(admin-v2): add notification bell, dropdown, and notifications page"
```

---

## Task 16: Manual Verification

- [ ] **Step 1: Start backend queue worker**

Run: `cd apps/backend && php artisan queue:work`

- [ ] **Step 2: Start backend server**

Run: `cd apps/backend && php artisan serve`

- [ ] **Step 3: Start admin-v2 dev server**

Run: `cd apps/admin-v2 && npm run dev`

- [ ] **Step 4: Test notification flow end-to-end**

1. Login to admin-v2
2. Create a reservation via admin panel
3. Check that notification bell shows unread badge
4. Click bell — dropdown shows "Nueva reserva" notification
5. Click notification — marks as read, badge decrements
6. Click "Ver todas" — full notifications page loads
7. Confirm reservation — check that client would receive ReservationConfirmed
8. Cancel reservation — check that notifications appear for both sides

- [ ] **Step 5: Test customer_v2**

1. Build and run Flutter app: `cd apps/customer_v2 && flutter run`
2. Login
3. Navigate to /notifications — should show real notifications from API
4. Pull to refresh works
5. Tap notification navigates to reservation detail
6. "Marcar todas" button works

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: adjustments from manual testing"
```
