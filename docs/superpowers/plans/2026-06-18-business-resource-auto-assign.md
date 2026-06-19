# Business Resource Auto-Assign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `allow_client_resource_selection = false` and a tenant has active business resources, `CreateReservationUseCase` auto-assigns the first free resource (by `sort_order`) to every new reservation — rejecting with 409 if all are occupied.

**Architecture:** Data layer first (migration → entity → DTO → repo → HTTP resource), then logic (exception + use case update + tests), then frontend entity/mapper. Each task compiles and runs independently.

**Tech Stack:** Laravel 13 (PHP 8.3), Pest, SQLite in-memory tests, Next.js 16, TypeScript.

## Global Constraints

- Backend Clean Architecture: no framework imports in `Domain` layer.
- Models live in `app/Infrastructure/Persistence/Models/`, use `HasUuids`, `BelongsToTenant`.
- Always use `config()` not `env()` in app code.
- Exceptions extend `App\Domain\Shared\Exceptions\AppException` — global handler in `bootstrap/app.php` renders them as JSON automatically.
- Tests: Pest + SQLite in-memory. Run via `composer test` from `apps/backend/`.
- Frontend: no direct `api.*` calls in components — use repository + use-case pattern.

---

## Task 1: Data layer — migration, entity, DTO, model, repository, HTTP resource, request, controller

Adds `business_resource_id` everywhere it needs to appear before any logic touches it.

**Files:**
- Create: `apps/backend/database/migrations/2026_06_18_000001_add_business_resource_id_to_reservations.php`
- Modify: `apps/backend/app/Domain/Reservation/Entities/Reservation.php`
- Modify: `apps/backend/app/Application/DTOs/Reservation/CreateReservationDTO.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ReservationModel.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentReservationRepository.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ReservationResource.php`
- Modify: `apps/backend/app/Infrastructure/Http/Requests/Reservation/CreateReservationRequest.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php`
- Test: `apps/backend/tests/Feature/BusinessResource/BusinessResourceDataLayerTest.php`

**Interfaces:**
- Produces: `Reservation::$businessResourceId: ?string`, `CreateReservationDTO::$businessResourceId: ?string`, `POST /api/v1/reservations` accepts optional `business_resource_id`, response includes `business_resource_id`

- [ ] **Step 1: Write failing test**

```php
// apps/backend/tests/Feature/BusinessResource/BusinessResourceDataLayerTest.php
<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'settings' => ['allow_client_resource_selection' => true],
    ]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type' => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    for ($day = 0; $day <= 6; $day++) {
        AvailabilitySlotModel::create([
            'tenant_id'      => $this->tenant->id,
            'day_of_week'    => $day,
            'start_time'     => '00:00:00',
            'end_time'       => '23:59:00',
            'max_concurrent' => 10,
            'is_active'      => true,
        ]);
    }
});

it('stores and returns business_resource_id when passed in request', function () {
    $resource = BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Estación 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id'  => $this->clientResource->id,
            'service_id'          => $this->service->id,
            'scheduled_at'        => $scheduledAt->toIso8601String(),
            'business_resource_id' => $resource->id,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $resource->id);

    $this->assertDatabaseHas('reservations', [
        'business_resource_id' => $resource->id,
    ]);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/backend && ./vendor/bin/pest tests/Feature/BusinessResource/BusinessResourceDataLayerTest.php -v
```
Expected: FAIL — column `business_resource_id` does not exist.

- [ ] **Step 3: Write migration**

```php
// apps/backend/database/migrations/2026_06_18_000001_add_business_resource_id_to_reservations.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->foreignUuid('business_resource_id')
                ->nullable()
                ->after('client_resource_id')
                ->constrained('business_resources')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('business_resource_id');
        });
    }
};
```

- [ ] **Step 4: Run migration**

```bash
cd apps/backend && php artisan migrate
```
Expected: `Migrating: 2026_06_18_000001_add_business_resource_id_to_reservations` + `Migrated`.

- [ ] **Step 5: Update `Reservation` entity**

Open `apps/backend/app/Domain/Reservation/Entities/Reservation.php`. Add `public ?string $businessResourceId` after `clientResourceId`:

```php
final readonly class Reservation
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $clientId,
        public ?string $clientResourceId,
        public ?string $businessResourceId,
        public string $serviceId,
        public ?string $assignedTo,
        public \DateTimeImmutable $scheduledAt,
        public \DateTimeImmutable $estimatedEnd,
        public ReservationStatus $status,
        public ?string $notes,
        public ?\DateTimeImmutable $cancelledAt,
        public ?string $cancelReason,
        public string $createdBy,
    ) {}
}
```

- [ ] **Step 6: Update `CreateReservationDTO`**

Open `apps/backend/app/Application/DTOs/Reservation/CreateReservationDTO.php`. Add `businessResourceId` as an optional parameter and update `fromArray`:

```php
final readonly class CreateReservationDTO
{
    public function __construct(
        public string $tenantId,
        public string $clientId,
        public ?string $clientResourceId,
        public string $serviceId,
        public string $scheduledAt,
        public string $createdBy,
        public ?string $assignedTo = null,
        public ?string $notes = null,
        public ?string $serviceVariantId = null,
        public ?string $businessResourceId = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            clientId: $data['client_id'],
            clientResourceId: $data['client_resource_id'] ?? null,
            serviceId: $data['service_id'],
            scheduledAt: $data['scheduled_at'],
            createdBy: $data['created_by'],
            assignedTo: $data['assigned_to'] ?? null,
            notes: $data['notes'] ?? null,
            serviceVariantId: $data['service_variant_id'] ?? null,
            businessResourceId: $data['business_resource_id'] ?? null,
        );
    }
}
```

- [ ] **Step 7: Update `ReservationModel` fillable**

Open `apps/backend/app/Infrastructure/Persistence/Models/ReservationModel.php`. Add `'business_resource_id'` to `$fillable` after `'client_resource_id'`:

```php
protected $fillable = [
    'tenant_id', 'client_id', 'client_resource_id', 'business_resource_id', 'service_id', 'service_variant_id',
    'assigned_to', 'scheduled_at', 'estimated_end', 'status',
    'notes', 'cancelled_at', 'cancel_reason', 'created_by',
    'consumption_applied_at',
    'checked_in_at', 'billing_snapshot',
    'client_rescheduled_at',
    'payment_status', 'payment_method', 'paid_at', 'payment_reference', 'payment_bank',
];
```

- [ ] **Step 8: Update `EloquentReservationRepository`**

Open `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentReservationRepository.php`.

In `save()`, add `'business_resource_id' => $reservation->businessResourceId` to `$data` after `client_resource_id`:

```php
$data = [
    'tenant_id'            => $reservation->tenantId,
    'client_id'            => $reservation->clientId,
    'client_resource_id'   => $reservation->clientResourceId,
    'business_resource_id' => $reservation->businessResourceId,
    'service_id'           => $reservation->serviceId,
    'assigned_to'          => $reservation->assignedTo,
    'scheduled_at'         => $reservation->scheduledAt->format('Y-m-d H:i:s'),
    'estimated_end'        => $reservation->estimatedEnd->format('Y-m-d H:i:s'),
    'status'               => $reservation->status->value,
    'notes'                => $reservation->notes,
    'cancelled_at'         => $reservation->cancelledAt?->format('Y-m-d H:i:s'),
    'cancel_reason'        => $reservation->cancelReason,
    'created_by'           => $reservation->createdBy,
];
```

In `mapToEntity()`, add `businessResourceId: $model->business_resource_id` after `clientResourceId`:

```php
private function mapToEntity(ReservationModel $model): Reservation
{
    return new Reservation(
        id: $model->id,
        tenantId: $model->tenant_id,
        clientId: $model->client_id,
        clientResourceId: $model->client_resource_id,
        businessResourceId: $model->business_resource_id,
        serviceId: $model->service_id,
        assignedTo: $model->assigned_to,
        scheduledAt: \DateTimeImmutable::createFromMutable($model->scheduled_at->toDateTime()),
        estimatedEnd: \DateTimeImmutable::createFromMutable($model->estimated_end->toDateTime()),
        status: ReservationStatus::from($model->status),
        notes: $model->notes,
        cancelledAt: $model->cancelled_at
            ? \DateTimeImmutable::createFromMutable($model->cancelled_at->toDateTime())
            : null,
        cancelReason: $model->cancel_reason,
        createdBy: $model->created_by,
    );
}
```

- [ ] **Step 9: Update `ReservationResource`**

Open `apps/backend/app/Infrastructure/Http/Resources/ReservationResource.php`. Add `'business_resource_id'` after `'client_resource_id'`:

```php
'id'                  => $this->id,
'client_id'           => $this->client_id,
'client_resource_id'  => $this->client_resource_id,
'business_resource_id' => $this->business_resource_id,
'service_id'          => $this->service_id,
```

- [ ] **Step 10: Update `CreateReservationRequest` validation**

Open `apps/backend/app/Infrastructure/Http/Requests/Reservation/CreateReservationRequest.php`. Add validation rule for `business_resource_id`:

```php
public function rules(): array
{
    return [
        'client_id'            => ['nullable', 'uuid'],
        'client_resource_id'   => ['nullable', 'uuid'],
        'business_resource_id' => ['nullable', 'uuid', 'exists:business_resources,id'],
        'service_id'           => ['required_without:items', 'nullable', 'uuid'],
        'service_variant_id'   => ['nullable', 'uuid'],
        'items'                => ['nullable', 'array', 'min:1', 'max:10'],
        'items.*.service_variant_id' => ['required_with:items', 'uuid'],
        'items.*.qty'                => ['nullable', 'integer', 'min:1', 'max:10'],
        'scheduled_at'         => ['required', 'date', 'after:now'],
        'assigned_to'          => ['nullable', 'uuid'],
        'notes'                => ['nullable', 'string', 'max:500'],
    ];
}
```

- [ ] **Step 11: Update `ReservationController::store()`**

Open `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php`. In the `store()` method, add `businessResourceId` to the DTO constructor call (around line 218):

```php
$dto = new CreateReservationDTO(
    tenantId: $tenantId,
    clientId: $request->client_id ?? $request->user()->id,
    clientResourceId: $request->client_resource_id,
    serviceId: $serviceId,
    scheduledAt: $request->scheduled_at,
    createdBy: $request->user()->id,
    assignedTo: $request->assigned_to,
    notes: $request->notes,
    serviceVariantId: $variantId,
    businessResourceId: $request->business_resource_id,
);
```

- [ ] **Step 12: Run test to confirm it passes**

```bash
cd apps/backend && ./vendor/bin/pest tests/Feature/BusinessResource/BusinessResourceDataLayerTest.php -v
```
Expected: 1 test PASS.

- [ ] **Step 13: Run full suite to confirm no regressions**

```bash
cd apps/backend && composer test
```
Expected: all tests PASS.

- [ ] **Step 14: Commit**

```bash
cd apps/backend && git add \
  database/migrations/2026_06_18_000001_add_business_resource_id_to_reservations.php \
  app/Domain/Reservation/Entities/Reservation.php \
  app/Application/DTOs/Reservation/CreateReservationDTO.php \
  app/Infrastructure/Persistence/Models/ReservationModel.php \
  app/Infrastructure/Persistence/Repositories/EloquentReservationRepository.php \
  app/Infrastructure/Http/Resources/ReservationResource.php \
  app/Infrastructure/Http/Requests/Reservation/CreateReservationRequest.php \
  app/Infrastructure/Http/Controllers/Reservation/ReservationController.php \
  tests/Feature/BusinessResource/BusinessResourceDataLayerTest.php
git commit -m "feat(backend): add business_resource_id to reservations data layer"
```

---

## Task 2: `NoResourceAvailableException` + auto-assign in `CreateReservationUseCase`

**Files:**
- Create: `apps/backend/app/Domain/BusinessResource/Exceptions/NoResourceAvailableException.php`
- Modify: `apps/backend/app/Application/UseCases/Reservation/CreateReservationUseCase.php`
- Create: `apps/backend/tests/Feature/BusinessResource/BusinessResourceAutoAssignTest.php`

**Interfaces:**
- Consumes: `Reservation::$businessResourceId` from Task 1, `BusinessResourceModel` (Infrastructure), `ReservationModel` (Infrastructure)
- Produces: auto-assigned `businessResourceId` on saved `Reservation`; HTTP 409 with `{ "error": { "code": "NO_RESOURCE_AVAILABLE", "message": "No hay recursos disponibles para ese horario" } }` when all occupied

- [ ] **Step 1: Write all 5 failing tests**

```php
// apps/backend/tests/Feature/BusinessResource/BusinessResourceAutoAssignTest.php
<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'settings' => ['allow_client_resource_selection' => false],
    ]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    for ($day = 0; $day <= 6; $day++) {
        AvailabilitySlotModel::create([
            'tenant_id'      => $this->tenant->id,
            'day_of_week'    => $day,
            'start_time'     => '00:00:00',
            'end_time'       => '23:59:00',
            'max_concurrent' => 10,
            'is_active'      => true,
        ]);
    }
});

it('auto_assigns first available resource ordered by sort_order', function () {
    $r1 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);
    BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 2', 'type' => 'physical', 'is_active' => true, 'sort_order' => 1,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $r1->id);
});

it('assigns second resource when first is busy in the same slot', function () {
    $r1 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);
    $r2 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 2', 'type' => 'physical', 'is_active' => true, 'sort_order' => 1,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);
    $slotDuration = $this->tenant->settings['slot_duration_minutes'] ?? 30;
    $estimatedEnd = (clone $scheduledAt)->addMinutes($slotDuration);

    // Pre-book resource 1 in the same slot
    ReservationModel::factory()->create([
        'tenant_id'            => $this->tenant->id,
        'client_id'            => $this->user->id,
        'client_resource_id'   => $this->clientResource->id,
        'service_id'           => $this->service->id,
        'created_by'           => $this->user->id,
        'business_resource_id' => $r1->id,
        'scheduled_at'         => $scheduledAt,
        'estimated_end'        => $estimatedEnd,
        'status'               => 'pending',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $r2->id);
});

it('returns 409 when all resources are occupied in the requested slot', function () {
    $slotDuration = $this->tenant->settings['slot_duration_minutes'] ?? 30;
    $scheduledAt  = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);
    $estimatedEnd = (clone $scheduledAt)->addMinutes($slotDuration);

    foreach (['Estación 1', 'Estación 2'] as $i => $name) {
        $resource = BusinessResourceModel::create([
            'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
            'name' => $name, 'type' => 'physical', 'is_active' => true, 'sort_order' => $i,
        ]);
        ReservationModel::factory()->create([
            'tenant_id'            => $this->tenant->id,
            'client_id'            => $this->user->id,
            'client_resource_id'   => $this->clientResource->id,
            'service_id'           => $this->service->id,
            'created_by'           => $this->user->id,
            'business_resource_id' => $resource->id,
            'scheduled_at'         => $scheduledAt,
            'estimated_end'        => $estimatedEnd,
            'status'               => 'pending',
        ]);
    }

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(409);
    $response->assertJsonPath('error.code', 'NO_RESOURCE_AVAILABLE');
});

it('creates reservation without business_resource_id when tenant has no resources', function () {
    // No BusinessResourceModel records for this tenant

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', null);
});

it('uses client-provided business_resource_id when allow_client_resource_selection is true', function () {
    $settings = $this->tenant->settings;
    $settings['allow_client_resource_selection'] = true;
    $this->tenant->update(['settings' => $settings]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $r1 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);
    $r2 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 2', 'type' => 'physical', 'is_active' => true, 'sort_order' => 1,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    // Client explicitly picks r2 (not r1 which would be auto-assigned)
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id'   => $this->clientResource->id,
            'service_id'           => $this->service->id,
            'scheduled_at'         => $scheduledAt->toIso8601String(),
            'business_resource_id' => $r2->id,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $r2->id);
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd apps/backend && ./vendor/bin/pest tests/Feature/BusinessResource/BusinessResourceAutoAssignTest.php -v
```
Expected: 5 tests FAIL (exception class not found or logic missing).

- [ ] **Step 3: Create `NoResourceAvailableException`**

```php
// apps/backend/app/Domain/BusinessResource/Exceptions/NoResourceAvailableException.php
<?php

namespace App\Domain\BusinessResource\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

final class NoResourceAvailableException extends AppException
{
    public function __construct()
    {
        parent::__construct('No hay recursos disponibles para ese horario', 409);
    }

    public function getErrorCode(): string
    {
        return 'NO_RESOURCE_AVAILABLE';
    }

    public function getStatusCode(): int
    {
        return 409;
    }
}
```

- [ ] **Step 4: Update `CreateReservationUseCase`**

Open `apps/backend/app/Application/UseCases/Reservation/CreateReservationUseCase.php`.

Add import at the top with the other use statements:
```php
use App\Domain\BusinessResource\Exceptions\NoResourceAvailableException;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
```

After the existing conflict check (after `if (count($conflicts) >= $slot->max_concurrent)`), add the resource assignment block before the `new Reservation(...)` constructor call:

```php
// Auto-assign or use client-selected business resource
$activeResources = BusinessResourceModel::where('tenant_id', $dto->tenantId)
    ->where('is_active', true)
    ->orderBy('sort_order')
    ->orderBy('name')
    ->get();

$businessResourceId = null;

if ($activeResources->isNotEmpty()) {
    $allowClientSelection = (bool) ($tenant->settings['allow_client_resource_selection'] ?? false);

    if (!$allowClientSelection) {
        $assigned = $activeResources->first(function ($resource) use ($scheduledAt, $estimatedEnd) {
            return !\App\Infrastructure\Persistence\Models\ReservationModel::where('business_resource_id', $resource->id)
                ->where('scheduled_at', '<', $estimatedEnd->format('Y-m-d H:i:s'))
                ->where('estimated_end', '>', $scheduledAt->format('Y-m-d H:i:s'))
                ->whereNotIn('status', ['cancelled', 'no_show'])
                ->exists();
        });

        if (!$assigned) {
            throw new NoResourceAvailableException();
        }

        $businessResourceId = $assigned->id;
    } else {
        $businessResourceId = $dto->businessResourceId;
    }
}
```

Then update the `new Reservation(...)` constructor to pass `businessResourceId` after `clientResourceId`:

```php
$reservation = new Reservation(
    id: (string) Str::uuid(),
    tenantId: $dto->tenantId,
    clientId: $dto->clientId,
    clientResourceId: $dto->clientResourceId,
    businessResourceId: $businessResourceId,
    serviceId: $dto->serviceId,
    assignedTo: $dto->assignedTo,
    scheduledAt: $scheduledAt,
    estimatedEnd: $estimatedEnd,
    status: ReservationStatus::Pending,
    notes: $dto->notes,
    cancelledAt: null,
    cancelReason: null,
    createdBy: $dto->createdBy,
);
```

- [ ] **Step 5: Run tests to confirm they all pass**

```bash
cd apps/backend && ./vendor/bin/pest tests/Feature/BusinessResource/BusinessResourceAutoAssignTest.php -v
```
Expected: 5 tests PASS.

- [ ] **Step 6: Run full suite to confirm no regressions**

```bash
cd apps/backend && composer test
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
cd apps/backend && git add \
  app/Domain/BusinessResource/Exceptions/NoResourceAvailableException.php \
  app/Application/UseCases/Reservation/CreateReservationUseCase.php \
  tests/Feature/BusinessResource/BusinessResourceAutoAssignTest.php
git commit -m "feat(backend): auto-assign business resource on reservation creation"
```

---

## Task 3: Frontend — entity + mapper

Adds `businessResourceId` to the frontend `Reservation` type so the field round-trips from the API and is available for display.

**Files:**
- Modify: `apps/admin-v2/src/domain/entities/reservation.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/mappers/reservation.mapper.ts`

**Interfaces:**
- Consumes: `business_resource_id` from API response (Task 1)
- Produces: `Reservation.businessResourceId: string | null`

- [ ] **Step 1: Add `businessResourceId` to `Reservation` interface**

Open `apps/admin-v2/src/domain/entities/reservation.ts`. In the `Reservation` interface, add `businessResourceId` after `clientResourceId`:

```typescript
export interface Reservation {
  id: string;
  clientId: string;
  clientResourceId: string;
  businessResourceId: string | null;
  serviceId: string;
  // ... rest unchanged
```

- [ ] **Step 2: Add `businessResourceId` to mapper**

Open `apps/admin-v2/src/infrastructure/api/mappers/reservation.mapper.ts`. In `mapReservation()`, add `businessResourceId` after `clientResourceId`:

```typescript
return {
  id: raw.id as string,
  clientId: raw.client_id as string,
  clientResourceId: raw.client_resource_id as string,
  businessResourceId: (raw.business_resource_id as string | null) ?? null,
  serviceId: raw.service_id as string,
  // ... rest unchanged
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd apps/admin-v2 && npm run build 2>&1 | tail -20
```
Expected: build succeeds with no type errors related to `businessResourceId`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-v2/src/domain/entities/reservation.ts \
        apps/admin-v2/src/infrastructure/api/mappers/reservation.mapper.ts
git commit -m "feat(admin): add businessResourceId to Reservation entity and mapper"
```

---

## Self-Review

### Spec coverage
- [x] Migration adds `business_resource_id` FK to `reservations` — Task 1
- [x] `Reservation` entity has `businessResourceId: ?string` — Task 1
- [x] Auto-assign: first available by `sort_order` when `allow_client_resource_selection = false` — Task 2
- [x] `NoResourceAvailableException` → HTTP 409 via global AppException handler — Task 2
- [x] Skip auto-assign when tenant has no resources — Task 2 test 4
- [x] Use DTO value when `allow_client_resource_selection = true` — Task 2 test 5
- [x] Frontend entity + mapper — Task 3
- [x] 5 Pest tests covering all scenarios — Task 2

### Out of scope (per spec)
- Public booking flow resource picker UI
- Showing resource name in reservation card (requires `useBusinessResources()` lookup — separate UI task)
- Resource capacity > 1
