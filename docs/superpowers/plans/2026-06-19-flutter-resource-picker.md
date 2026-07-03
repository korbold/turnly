# Flutter Business Resource Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a wizard step in the Flutter booking flow that lets customers pick their preferred barber/station/room when `allow_client_resource_selection = true`.

**Architecture:** Backend exposes `business_resources` + `allow_client_resource_selection` in `getTenant`; the authenticated available-slots endpoint accepts an optional `business_resource_id` to filter by resource availability. Flutter adds a `BusinessResource` entity, wires it through the repository → cubit → screen, and inserts a new `_StepBusinessResource` wizard step before date selection.

**Tech Stack:** Laravel 13 (PHP), Flutter 3.x + BLoC/Cubit, Dart, fpdart Either, Pest (PHP tests).

## Global Constraints

- Flutter: BLoC pattern, fpdart Either for errors, no exceptions in domain layer.
- Laravel: Clean architecture — Domain → Application → Infrastructure. No `env()` in app code; use `config()`.
- No new migrations. All changes use existing `business_resources`, `users`, `reservations` tables.
- `AvatarCircle` widget (`lib/shared/widgets/avatar_circle.dart`) already exists — use it for employee avatars.
- Backend `BusinessResourceModel` relationship: `employee()` returns `belongsTo(UserModel::class, 'employee_id')`. `UserModel` has `name` field but no photo field → `photo_url` always `null` for now.
- `_StepBusinessResource` is the NEW step (barber/station picker). `_Step1ResourceSelection` is the EXISTING step (vehicle/pet). They are independent.
- Step ordering in PageView: `[_StepBusinessResource?, _Step1ResourceSelection?, _Step2DateSlot, _Step3Confirm]`.

---

## File Map

**Create:**
- `apps/customer_v2/lib/features/explore/domain/entities/business_resource.dart`
- `apps/backend/tests/Feature/PublicTenantBusinessResourcesTest.php`
- `apps/backend/tests/Feature/Reservation/AvailableSlotsByResourceTest.php`

**Modify:**
- `apps/backend/app/Infrastructure/Http/Controllers/PublicController.php` — `getTenant` response
- `apps/backend/app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php` — add `businessResourceId`
- `apps/backend/app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php` — filter by resource
- `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php` — pass businessResourceId
- `apps/customer_v2/lib/features/explore/domain/entities/business.dart` — add two fields
- `apps/customer_v2/lib/features/explore/data/dtos/business_dto.dart` — parse new fields
- `apps/customer_v2/lib/features/reservations/domain/repositories/reservation_repository.dart` — add params
- `apps/customer_v2/lib/features/reservations/data/repositories/reservation_repository_impl.dart` — pass params
- `apps/customer_v2/lib/features/reservations/presentation/cubit/create_reservation_cubit.dart` — resource selection state
- `apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart` — new step + confirm update
- `apps/customer_v2/lib/app/router.dart` — pass new params to CreateReservationScreen
- `apps/customer_v2/lib/features/business/presentation/screens/business_detail_screen.dart` — pass business resources

---

### Task 1: Backend — expose business_resources in getTenant

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/PublicController.php:165-248`
- Create: `apps/backend/tests/Feature/PublicTenantBusinessResourcesTest.php`

**Interfaces:**
- Produces: `GET /public/tenants/{slug}` response includes `data.tenant.settings.allow_client_resource_selection: bool` and `data.business_resources: [{id, name, type, employee: {name}|null}]`

- [ ] **Step 1: Write the failing test**

```php
// apps/backend/tests/Feature/PublicTenantBusinessResourcesTest.php
<?php

use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'slug'     => 'test-biz',
        'settings' => ['allow_client_resource_selection' => true],
    ]);
    TenantImageModel::create([
        'id'           => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'    => $this->tenant->id,
        'storage_path' => '/test.jpg',
        'url'          => 'https://example.com/test.jpg',
        'sort_order'   => 0,
    ]);
});

test('getTenant exposes allow_client_resource_selection setting', function () {
    $response = $this->getJson('/api/v1/public/tenants/test-biz');

    $response->assertOk()
        ->assertJsonPath('data.tenant.settings.allow_client_resource_selection', true);
});

test('getTenant exposes active business resources with employee', function () {
    $employee = UserModel::factory()->create(['name' => 'Juan Pérez']);

    BusinessResourceModel::create([
        'id'          => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'   => $this->tenant->id,
        'name'        => 'Silla Juan',
        'type'        => 'person',
        'employee_id' => $employee->id,
        'is_active'   => true,
        'sort_order'  => 0,
    ]);

    $response = $this->getJson('/api/v1/public/tenants/test-biz');

    $response->assertOk()
        ->assertJsonCount(1, 'data.business_resources')
        ->assertJsonPath('data.business_resources.0.name', 'Silla Juan')
        ->assertJsonPath('data.business_resources.0.type', 'person')
        ->assertJsonPath('data.business_resources.0.employee.name', 'Juan Pérez');
});

test('getTenant excludes inactive resources', function () {
    BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Silla Inactiva',
        'type'       => 'physical',
        'is_active'  => false,
        'sort_order' => 0,
    ]);

    $response = $this->getJson('/api/v1/public/tenants/test-biz');

    $response->assertOk()
        ->assertJsonCount(0, 'data.business_resources');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && php artisan test --filter=PublicTenantBusinessResourcesTest
```
Expected: 3 FAILs — `data.tenant.settings` key missing, `data.business_resources` key missing.

- [ ] **Step 3: Implement — update `getTenant` response**

In `apps/backend/app/Infrastructure/Http/Controllers/PublicController.php`, inside `getTenant()` after the `$images` query (around line 225), add:

```php
$businessResources = \App\Infrastructure\Persistence\Models\BusinessResourceModel::query()
    ->forTenant($tenant->id)
    ->where('is_active', true)
    ->with('employee:id,name')
    ->orderBy('sort_order')
    ->orderBy('name')
    ->get(['id', 'name', 'type', 'employee_id'])
    ->map(fn ($r) => [
        'id'       => $r->id,
        'name'     => $r->name,
        'type'     => $r->type,
        'employee' => $r->employee ? [
            'name'      => $r->employee->name,
            'photo_url' => null,
        ] : null,
    ]);
```

Then update the return response array. Change:
```php
'tenant' => [
    'name'             => $tenant->name,
    // ... existing fields ...
    'slot_duration'    => $tenant->settings['slot_duration_minutes'] ?? 30,
    'cancellation_hours' => $tenant->settings['cancellation_hours'] ?? 1,
],
```
To:
```php
'tenant' => [
    'name'             => $tenant->name,
    'slug'             => $tenant->slug,
    'description'      => $tenant->description,
    'business_type'    => $tenant->business_type,
    'logo_url'         => $tenant->logo_url,
    'cover_url'        => $tenant->cover_url,
    'brand_theme'      => $tenant->brand_theme,
    'social_links'     => $tenant->social_links,
    'address'          => $tenant->address,
    'phone'            => $tenant->phone,
    'custom_fields'    => $tenant->custom_fields,
    'slot_duration'    => $tenant->settings['slot_duration_minutes'] ?? 30,
    'cancellation_hours' => $tenant->settings['cancellation_hours'] ?? 1,
    'settings'         => [
        'allow_client_resource_selection' => (bool) ($tenant->settings['allow_client_resource_selection'] ?? false),
    ],
],
```

And add `'business_resources' => $businessResources,` alongside `'services'`, `'availability'`, `'images'` in the response data array.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && php artisan test --filter=PublicTenantBusinessResourcesTest
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/PublicController.php \
        apps/backend/tests/Feature/PublicTenantBusinessResourcesTest.php
git commit -m "feat(backend): expose business_resources and allow_client_resource_selection in getTenant"
```

---

### Task 2: Backend — filter available slots by business_resource_id

**Files:**
- Modify: `apps/backend/app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php`
- Modify: `apps/backend/app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php:457-479`
- Create: `apps/backend/tests/Feature/Reservation/AvailableSlotsByResourceTest.php`

**Interfaces:**
- Consumes: `AvailableSlotsQueryDTO` with new optional `?string $businessResourceId`
- Produces: `GET /api/v1/reservations/available-slots?business_resource_id=<uuid>` returns only slots where that resource is free

- [ ] **Step 1: Write the failing test**

```php
// apps/backend/tests/Feature/Reservation/AvailableSlotsByResourceTest.php
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
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user   = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    AvailabilitySlotModel::create([
        'tenant_id'      => $this->tenant->id,
        'day_of_week'    => 0, // filled in test with actual day
        'start_time'     => '08:00:00',
        'end_time'       => '18:00:00',
        'max_concurrent' => 5,
        'is_active'      => true,
    ]);

    $this->resource = BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Silla 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
    ]);
});

test('available slots without resource filter returns all slots', function () {
    $date = now()->addDay()->format('Y-m-d');
    $dayOfWeek = (int) now()->addDay()->format('N') - 1;

    // Update availability slot to match the test day
    \App\Infrastructure\Persistence\Models\AvailabilitySlotModel::query()
        ->forTenant($this->tenant->id)
        ->update(['day_of_week' => $dayOfWeek]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}");

    $response->assertOk();
    expect(count($response->json('data')))->toBeGreaterThan(0);
});

test('available slots filtered by resource excludes occupied slots', function () {
    $date     = now()->addDay()->format('Y-m-d');
    $dayOfWeek = (int) now()->addDay()->format('N') - 1;

    \App\Infrastructure\Persistence\Models\AvailabilitySlotModel::query()
        ->forTenant($this->tenant->id)
        ->update(['day_of_week' => $dayOfWeek]);

    $occupiedStart = now()->addDay()->setHour(9)->setMinute(0)->setSecond(0);
    $occupiedEnd   = (clone $occupiedStart)->addMinutes(30);

    $otherClient = UserModel::factory()->create();
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $otherClient->id,
    ]);

    ReservationModel::withoutGlobalScopes()->create([
        'id'                   => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'            => $this->tenant->id,
        'client_id'            => $otherClient->id,
        'service_id'           => $this->service->id,
        'created_by'           => $otherClient->id,
        'business_resource_id' => $this->resource->id,
        'client_resource_id'   => $clientResource->id,
        'scheduled_at'         => $occupiedStart,
        'estimated_end'        => $occupiedEnd,
        'status'               => 'pending',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}&business_resource_id={$this->resource->id}");

    $response->assertOk();

    $slots = $response->json('data');
    $occupiedSlotStart = $occupiedStart->format('Y-m-d H:i:s');
    $found = collect($slots)->first(fn ($s) => $s['start'] === $occupiedSlotStart);

    // The occupied slot must NOT appear when filtering by that resource
    expect($found)->toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && php artisan test --filter=AvailableSlotsByResourceTest
```
Expected: second test FAILs — occupied slot still appears because `business_resource_id` is ignored.

- [ ] **Step 3: Add `businessResourceId` to AvailableSlotsQueryDTO**

Replace the entire file `apps/backend/app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php`:

```php
<?php

namespace App\Application\DTOs\Reservation;

final readonly class AvailableSlotsQueryDTO
{
    public function __construct(
        public string $tenantId,
        public string $date,
        public string $serviceId,
        public ?string $businessResourceId = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            date: $data['date'],
            serviceId: $data['service_id'],
            businessResourceId: $data['business_resource_id'] ?? null,
        );
    }
}
```

- [ ] **Step 4: Filter reservations and override maxConcurrent in GetAvailableSlotsUseCase**

In `apps/backend/app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php`, after line `$existingReservations = $this->reservationRepository->findByTenantAndDate(...)` (line 37), add the filter block:

```php
$existingReservations = $this->reservationRepository->findByTenantAndDate($dto->tenantId, $dto->date);

if ($dto->businessResourceId !== null) {
    $existingReservations = array_values(array_filter(
        $existingReservations,
        fn ($r) => $r->businessResourceId === $dto->businessResourceId,
    ));
}
```

Then inside the `while` loop, replace:
```php
$maxConcurrent = $availability->max_concurrent;
```
With:
```php
$maxConcurrent = $dto->businessResourceId !== null ? 1 : $availability->max_concurrent;
```

- [ ] **Step 5: Pass business_resource_id in ReservationController::availableSlots**

In `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php`, replace `availableSlots()` (line 457–479):

```php
public function availableSlots(Request $request): JsonResponse
{
    $request->validate([
        'date'                 => 'required|date',
        'service_id'           => 'required|uuid',
        'business_resource_id' => 'nullable|uuid|exists:business_resources,id,tenant_id,' . app('current_tenant_id'),
    ]);

    $dto = new AvailableSlotsQueryDTO(
        tenantId:           app('current_tenant_id'),
        date:               $request->date,
        serviceId:          $request->service_id,
        businessResourceId: $request->business_resource_id,
    );

    $slots = $this->getAvailableSlots->execute($dto);

    return response()->json([
        'data' => $slots,
        'meta' => [
            'tenant'    => app('current_tenant')->slug ?? null,
            'timestamp' => now()->toIso8601String(),
        ],
    ]);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/backend && php artisan test --filter=AvailableSlotsByResourceTest
```
Expected: 2 PASS.

- [ ] **Step 7: Run full backend test suite to check for regressions**

```bash
cd apps/backend && composer test 2>&1 | tail -20
```
Expected: same pass/fail counts as before (6 pre-existing failures in ClientResourceTest + ServiceLogTest are expected).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php \
        apps/backend/app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php \
        apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php \
        apps/backend/tests/Feature/Reservation/AvailableSlotsByResourceTest.php
git commit -m "feat(backend): filter available slots by business_resource_id"
```

---

### Task 3: Flutter — BusinessResource entity + Business entity + BusinessDto

**Files:**
- Create: `apps/customer_v2/lib/features/explore/domain/entities/business_resource.dart`
- Modify: `apps/customer_v2/lib/features/explore/domain/entities/business.dart`
- Modify: `apps/customer_v2/lib/features/explore/data/dtos/business_dto.dart`

**Interfaces:**
- Produces:
  - `BusinessResource {String id, String name, String type, String? employeeName, String? employeePhotoUrl}`
  - `Business.allowClientResourceSelection: bool`
  - `Business.businessResources: List<BusinessResource>`
  - `BusinessDto.toEntity()` parses `data.tenant.settings.allow_client_resource_selection` and `data.business_resources`

- [ ] **Step 1: Create BusinessResource entity**

Create `apps/customer_v2/lib/features/explore/domain/entities/business_resource.dart`:

```dart
// lib/features/explore/domain/entities/business_resource.dart
import 'package:equatable/equatable.dart';

class BusinessResource extends Equatable {
  final String id;
  final String name;
  final String type; // 'physical' | 'person'
  final String? employeeName;
  final String? employeePhotoUrl;

  const BusinessResource({
    required this.id,
    required this.name,
    required this.type,
    this.employeeName,
    this.employeePhotoUrl,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 2: Add fields to Business entity**

In `apps/customer_v2/lib/features/explore/domain/entities/business.dart`, add import and two fields:

```dart
// lib/features/explore/domain/entities/business.dart
import 'package:equatable/equatable.dart';
import 'service.dart';
import 'business_hours.dart';
import 'business_resource.dart';

class Business extends Equatable {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? address;
  final String? phone;
  final String? businessType;
  final String? logoUrl;
  final String? coverUrl;
  final String? mapsUrl;
  final int slotDuration;
  final int cancellationHours;
  final List<Service> services;
  final List<BusinessHours> hours;
  final List<Map<String, dynamic>> customFields;
  final bool allowClientResourceSelection;
  final List<BusinessResource> businessResources;

  const Business({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.address,
    this.phone,
    this.businessType,
    this.logoUrl,
    this.coverUrl,
    this.mapsUrl,
    this.slotDuration = 30,
    this.cancellationHours = 1,
    this.services = const [],
    this.hours = const [],
    this.customFields = const [],
    this.allowClientResourceSelection = false,
    this.businessResources = const [],
  });

  @override
  List<Object?> get props => [id, slug];
}
```

- [ ] **Step 3: Update BusinessDto to parse new fields**

In `apps/customer_v2/lib/features/explore/data/dtos/business_dto.dart`, replace the `toEntity()` method to add parsing of `settings` and `business_resources`. The JSON shape from the backend:

```json
{
  "data": {
    "tenant": { "settings": { "allow_client_resource_selection": true } },
    "business_resources": [{ "id": "...", "name": "...", "type": "...", "employee": { "name": "..." } }]
  }
}
```

Note: `BusinessDto` receives either the raw `data` object or the `tenant` sub-object depending on call site. Currently `json['slug']` is read directly and `json['tenant']?['slot_duration']` is a fallback. The `business_resources` key is at `data` level, same as `services` and `availability`.

Add this static helper at the bottom of `BusinessDto`:

```dart
static List<BusinessResource> _parseBusinessResources(List<dynamic> raw) {
  return raw
      .whereType<Map<String, dynamic>>()
      .map((r) {
        final employee = r['employee'] as Map<String, dynamic>?;
        return BusinessResource(
          id: r['id'] as String? ?? '',
          name: r['name'] as String? ?? '',
          type: r['type'] as String? ?? 'physical',
          employeeName: employee?['name'] as String?,
          employeePhotoUrl: employee?['photo_url'] as String?,
        );
      })
      .toList();
}
```

Then update the `toEntity()` return to include the two new fields:

```dart
Business toEntity() {
  final servicesJson = json['services'] as List<dynamic>? ?? [];
  final availabilityJson = json['availability'] as List<dynamic>? ?? [];
  final businessResourcesJson = json['business_resources'] as List<dynamic>? ?? [];
  final tenantSlotDuration = (json['slot_duration'] as int?) ??
      (json['tenant'] as Map<String, dynamic>?)?['slot_duration'] as int? ??
      30;
  final tenantSettings =
      (json['tenant'] as Map<String, dynamic>?)?['settings'] as Map<String, dynamic>? ?? {};

  return Business(
    id: json['id'] as String? ?? json['slug'] as String? ?? '',
    slug: json['slug'] as String? ?? '',
    name: json['name'] as String? ?? '',
    description: json['description'] as String?,
    address: json['address'] as String?,
    phone: json['phone'] as String?,
    businessType: json['business_type'] as String?,
    logoUrl: json['logo_url'] as String?,
    coverUrl: json['cover_url'] as String?,
    mapsUrl: (json['social_links'] as Map<String, dynamic>?)?['maps_url'] as String?,
    slotDuration: json['slot_duration'] as int? ?? 30,
    cancellationHours: json['cancellation_hours'] as int? ?? 1,
    services: servicesJson
        .map((s) => _serviceFromJson(s as Map<String, dynamic>, tenantSlotDuration))
        .toList(),
    hours: _parseAvailability(availabilityJson),
    customFields: (json['custom_fields'] as List<dynamic>?)
            ?.map((e) => e as Map<String, dynamic>)
            .toList() ??
        [],
    allowClientResourceSelection:
        tenantSettings['allow_client_resource_selection'] as bool? ?? false,
    businessResources: _parseBusinessResources(businessResourcesJson),
  );
}
```

- [ ] **Step 4: Run Flutter analyzer**

```bash
cd apps/customer_v2 && fvm flutter analyze lib/features/explore/ 2>&1 | grep -E "error|warning" | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/customer_v2/lib/features/explore/domain/entities/business_resource.dart \
        apps/customer_v2/lib/features/explore/domain/entities/business.dart \
        apps/customer_v2/lib/features/explore/data/dtos/business_dto.dart
git commit -m "feat(flutter): add BusinessResource entity and extend Business with resource picker fields"
```

---

### Task 4: Flutter — repository interface + impl

**Files:**
- Modify: `apps/customer_v2/lib/features/reservations/domain/repositories/reservation_repository.dart`
- Modify: `apps/customer_v2/lib/features/reservations/data/repositories/reservation_repository_impl.dart`

**Interfaces:**
- Consumes: nothing new from earlier tasks
- Produces:
  - `getAvailableSlots(date, serviceId, {durationMin, variantIds, businessResourceId})` — adds optional `String? businessResourceId`
  - `createWithItems({..., businessResourceId})` — adds optional `String? businessResourceId`
  - `create({..., businessResourceId})` — adds optional `String? businessResourceId`

- [ ] **Step 1: Update repository interface**

In `apps/customer_v2/lib/features/reservations/domain/repositories/reservation_repository.dart`:

Replace `getAvailableSlots` signature:
```dart
Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
  String date,
  String serviceId, {
  int? durationMin,
  List<String>? variantIds,
  String? businessResourceId,
});
```

Replace `create` signature:
```dart
Future<Either<Failure, Reservation>> create({
  required String tenantSlug,
  required String clientResourceId,
  required String serviceId,
  required String scheduledAt,
  String? notes,
  String? businessResourceId,
});
```

Replace `createWithItems` signature:
```dart
Future<Either<Failure, Reservation>> createWithItems({
  required String tenantSlug,
  required String clientResourceId,
  required List<BookingItem> items,
  required String scheduledAt,
  String? notes,
  String? businessResourceId,
});
```

- [ ] **Step 2: Update repository implementation**

In `apps/customer_v2/lib/features/reservations/data/repositories/reservation_repository_impl.dart`:

**`getAvailableSlots`** — add param and pass to query:
```dart
@override
Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
  String date,
  String serviceId, {
  int? durationMin,
  List<String>? variantIds,
  String? businessResourceId,
}) async {
  try {
    final queryParams = <String, dynamic>{
      'date': date,
      'service_id': serviceId,
    };
    if (durationMin != null) queryParams['duration_min'] = durationMin;
    if (variantIds != null && variantIds.isNotEmpty) {
      queryParams['variant_ids'] = variantIds;
    }
    if (businessResourceId != null) {
      queryParams['business_resource_id'] = businessResourceId;
    }

    final response = await _dio.get(
      '/reservations/available-slots',
      queryParameters: queryParams,
    );

    final data = response.data['data'] as List<dynamic>;
    final slots = data.map((e) {
      final map = e as Map<String, dynamic>;
      return AvailableSlot(
        start: DateTime.parse(map['start'] as String),
        end: DateTime.parse(map['end'] as String),
        available: map['available'] as int,
      );
    }).toList();
    return Right(slots);
  } on DioException catch (e) {
    if (e.response?.statusCode == 401) return const Left(AuthFailure());
    return Left(ServerFailure(
      e.response?.data?['error']?['message'] ?? 'Error al obtener horarios',
    ));
  } catch (e) {
    return Left(ServerFailure(e.toString()));
  }
}
```

**`create`** — add `businessResourceId` param and include in body:
```dart
@override
Future<Either<Failure, Reservation>> create({
  required String tenantSlug,
  required String clientResourceId,
  required String serviceId,
  required String scheduledAt,
  String? notes,
  String? businessResourceId,
}) async {
  try {
    final response = await _dio.post(
      '/public/tenants/$tenantSlug/book',
      data: {
        if (clientResourceId.isNotEmpty) 'client_resource_id': clientResourceId,
        'service_id': serviceId,
        'scheduled_at': scheduledAt,
        if (notes != null) 'notes': notes,
        if (businessResourceId != null) 'business_resource_id': businessResourceId,
      },
    );
    return Right(
      ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
    );
  } on DioException catch (e) {
    if (e.response?.statusCode == 401) return const Left(AuthFailure());
    return Left(ServerFailure(_extractError(e)));
  } catch (e) {
    return Left(ServerFailure(e.toString()));
  }
}
```

**`createWithItems`** — add `businessResourceId` param and include in body:
```dart
@override
Future<Either<Failure, Reservation>> createWithItems({
  required String tenantSlug,
  required String clientResourceId,
  required List<BookingItem> items,
  required String scheduledAt,
  String? notes,
  String? businessResourceId,
}) async {
  try {
    final payloadItems = items
        .where((i) => i.serviceVariantId != null && i.serviceVariantId!.isNotEmpty)
        .map((i) => {
              'service_variant_id': i.serviceVariantId,
              'qty': i.qty,
            })
        .toList();

    final body = <String, dynamic>{
      if (clientResourceId.isNotEmpty) 'client_resource_id': clientResourceId,
      'scheduled_at': scheduledAt,
      if (notes != null) 'notes': notes,
      if (businessResourceId != null) 'business_resource_id': businessResourceId,
    };

    if (payloadItems.isNotEmpty) {
      body['items'] = payloadItems;
    } else if (items.isNotEmpty) {
      body['service_id'] = items.first.serviceId;
    }

    final response = await _dio.post(
      '/public/tenants/$tenantSlug/book',
      data: body,
    );
    return Right(
      ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
    );
  } on DioException catch (e) {
    if (e.response?.statusCode == 401) return const Left(AuthFailure());
    return Left(ServerFailure(_extractError(e)));
  } catch (e) {
    return Left(ServerFailure(e.toString()));
  }
}
```

- [ ] **Step 3: Run Flutter analyzer**

```bash
cd apps/customer_v2 && fvm flutter analyze lib/features/reservations/domain/ lib/features/reservations/data/ 2>&1 | grep -E "error|warning" | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/customer_v2/lib/features/reservations/domain/repositories/reservation_repository.dart \
        apps/customer_v2/lib/features/reservations/data/repositories/reservation_repository_impl.dart
git commit -m "feat(flutter): add businessResourceId param to reservation repository methods"
```

---

### Task 5: Flutter — cubit updates

**Files:**
- Modify: `apps/customer_v2/lib/features/reservations/presentation/cubit/create_reservation_cubit.dart`

**Interfaces:**
- Consumes: `getAvailableSlots(..., {businessResourceId})`, `createWithItems(..., {businessResourceId})`, `create(..., {businessResourceId})` from Task 4
- Produces:
  - `selectBusinessResource(String? id)` — stores selection, `_resourceStepCompleted = true`
  - `loadSlots(date, serviceId, {businessResourceId})` — passes through to repository
  - `createReservation({..., businessResourceId})` — passes through to repository

- [ ] **Step 1: Update cubit**

Replace the entire file `apps/customer_v2/lib/features/reservations/presentation/cubit/create_reservation_cubit.dart`:

```dart
// lib/features/reservations/presentation/cubit/create_reservation_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/booking_item.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'create_reservation_state.dart';

class CreateReservationCubit extends Cubit<CreateReservationState> {
  final ReservationRepository _repository;

  final List<BookingItem> _cart = [];
  int _cartVersion = 0;

  // null = no selection made or sin preferencia; check _resourceStepCompleted
  // to know whether the user has explicitly chosen.
  String? _selectedBusinessResourceId;
  bool _resourceStepCompleted = false;

  CreateReservationCubit(this._repository)
      : super(const CreateReservationInitial());

  List<BookingItem> get cart => List.unmodifiable(_cart);
  int get totalDurationMin =>
      _cart.fold(0, (acc, it) => acc + it.durationMin * it.qty);
  double get totalPrice => _cart.fold(0, (acc, it) => acc + it.lineTotal);

  void _emitCart() => emit(CreateReservationInitial(version: ++_cartVersion));

  void seedCart(List<BookingItem> items) {
    _cart
      ..clear()
      ..addAll(items);
    _emitCart();
  }

  void addToCart(BookingItem item) {
    final existing = _cart.indexWhere(
      (i) =>
          i.serviceId == item.serviceId &&
          i.serviceVariantId == item.serviceVariantId,
    );
    if (existing >= 0) {
      _cart[existing] = _cart[existing].copyWith(qty: _cart[existing].qty + 1);
    } else {
      _cart.add(item);
    }
    _emitCart();
  }

  void removeFromCart(int index) {
    if (index < 0 || index >= _cart.length) return;
    _cart.removeAt(index);
    _emitCart();
  }

  // null = "sin preferencia" selected; sets _resourceStepCompleted = true.
  void selectBusinessResource(String? id) {
    _selectedBusinessResourceId = id;
    _resourceStepCompleted = true;
    // No state emit — UI drives navigation via PageController.
  }

  Future<void> loadSlots(
    String date,
    String serviceId, {
    String? businessResourceId,
  }) async {
    emit(const CreateReservationLoadingSlots());
    final variantIds = _cart
        .where((i) => i.serviceVariantId != null)
        .map((i) => i.serviceVariantId!)
        .toList();
    final result = await _repository.getAvailableSlots(
      date,
      serviceId,
      durationMin: totalDurationMin > 0 ? totalDurationMin : null,
      variantIds: variantIds.isNotEmpty ? variantIds : null,
      businessResourceId: businessResourceId,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (slots) => emit(CreateReservationSlotsLoaded(slots)),
    );
  }

  Future<void> createReservation({
    required String tenantSlug,
    String? clientResourceId,
    String? businessResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    emit(const CreateReservationSubmitting());

    if (_cart.isNotEmpty) {
      final result = await _repository.createWithItems(
        tenantSlug: tenantSlug,
        clientResourceId: clientResourceId ?? '',
        items: _cart,
        scheduledAt: scheduledAt,
        notes: notes,
        businessResourceId: businessResourceId,
      );
      result.fold(
        (failure) => emit(CreateReservationError(failure.message)),
        (reservation) => emit(CreateReservationSuccess(reservation)),
      );
      return;
    }

    final result = await _repository.create(
      tenantSlug: tenantSlug,
      clientResourceId: clientResourceId ?? '',
      serviceId: serviceId,
      scheduledAt: scheduledAt,
      notes: notes,
      businessResourceId: businessResourceId,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (reservation) => emit(CreateReservationSuccess(reservation)),
    );
  }
}
```

- [ ] **Step 2: Run Flutter analyzer**

```bash
cd apps/customer_v2 && fvm flutter analyze lib/features/reservations/presentation/cubit/ 2>&1 | grep -E "error|warning" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/customer_v2/lib/features/reservations/presentation/cubit/create_reservation_cubit.dart
git commit -m "feat(flutter): add business resource selection to CreateReservationCubit"
```

---

### Task 6: Flutter — wizard step widget + screen wiring + router + navigation

**Files:**
- Modify: `apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart`
- Modify: `apps/customer_v2/lib/app/router.dart`
- Modify: `apps/customer_v2/lib/features/business/presentation/screens/business_detail_screen.dart`

**Interfaces:**
- Consumes: `BusinessResource` (Task 3), `selectBusinessResource()` / `loadSlots(businessResourceId:)` / `createReservation(businessResourceId:)` (Task 5)
- Produces: `CreateReservationScreen` accepts `allowClientResourceSelection: bool` and `businessResources: List<BusinessResource>`; shows `_StepBusinessResource` as first step when applicable

- [ ] **Step 1: Add imports and new constructor params to CreateReservationScreen**

In `apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart`:

Add imports at top:
```dart
import '../../../explore/domain/entities/business_resource.dart' as explore;
```

Update `CreateReservationScreen` constructor to add two new fields:
```dart
class CreateReservationScreen extends StatelessWidget {
  final String tenantSlug;
  final String? serviceId;
  final String? serviceVariantId;
  final List<explore.Service> services;
  final List<Map<String, dynamic>> customFields;
  final String? businessType;
  final bool allowClientResourceSelection;
  final List<explore_resource.BusinessResource> businessResources;

  const CreateReservationScreen({
    super.key,
    required this.tenantSlug,
    this.serviceId,
    this.serviceVariantId,
    this.services = const [],
    this.customFields = const [],
    this.businessType,
    this.allowClientResourceSelection = false,
    this.businessResources = const [],
  });
```

Note: add import for `BusinessResource` specifically. Since `explore.dart` already imports `service.dart` via `explore` alias, add a separate alias for `business_resource.dart`:
```dart
import '../../../explore/domain/entities/business_resource.dart' as explore_resource;
```

Also update the `_CreateReservationView` widget and its call in `build()` to pass `allowClientResourceSelection` and `businessResources` down:
```dart
// In CreateReservationScreen.build():
child: _CreateReservationView(
  tenantSlug: tenantSlug,
  serviceId: serviceId,
  serviceVariantId: serviceVariantId,
  services: services,
  customFields: customFields,
  businessType: businessType,
  allowClientResourceSelection: allowClientResourceSelection,
  businessResources: businessResources,
),
```

Update `_CreateReservationView` StatefulWidget and its state:
```dart
class _CreateReservationView extends StatefulWidget {
  final String tenantSlug;
  final String? serviceId;
  final String? serviceVariantId;
  final List<explore.Service> services;
  final List<Map<String, dynamic>> customFields;
  final String? businessType;
  final bool allowClientResourceSelection;
  final List<explore_resource.BusinessResource> businessResources;

  const _CreateReservationView({
    required this.tenantSlug,
    this.serviceId,
    this.serviceVariantId,
    this.services = const [],
    this.customFields = const [],
    this.businessType,
    this.allowClientResourceSelection = false,
    this.businessResources = const [],
  });

  @override
  State<_CreateReservationView> createState() => _CreateReservationViewState();
}
```

- [ ] **Step 2: Update _CreateReservationViewState step logic**

In `_CreateReservationViewState`, add new fields and update getters:

```dart
// Add after existing step fields:
String? _selectedBusinessResourceId;  // null = sin preferencia or not applicable
bool _businessResourceStepCompleted = false;

// NEW getter
bool get _showBusinessResourceStep =>
    widget.allowClientResourceSelection &&
    widget.businessResources.isNotEmpty;

// REPLACE existing _skipResourceStep and _totalSteps:
bool get _skipResourceStep =>
    widget.customFields
        .where((f) => (f['label'] as String?)?.trim().isNotEmpty == true)
        .isEmpty;

int get _totalSteps {
  int count = 2; // Date + Confirm always present
  if (!_skipResourceStep) count++;
  if (_showBusinessResourceStep) count++;
  return count;
}

List<String> get _stepLabels {
  final labels = <String>[];
  if (_showBusinessResourceStep) labels.add('Barbero');
  if (!_skipResourceStep) labels.add('Registro');
  labels.add('Fecha');
  labels.add('Confirmar');
  return labels;
}
```

- [ ] **Step 3: Update _loadSlots to pass businessResourceId**

Replace `_loadSlots()`:

```dart
void _loadSlots() {
  if (_selectedDate == null || _selectedService == null) return;
  final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate!);
  context.read<CreateReservationCubit>().loadSlots(
    dateStr,
    _selectedService!.id,
    businessResourceId: _showBusinessResourceStep
        ? _selectedBusinessResourceId
        : null,
  );
}
```

- [ ] **Step 4: Update _submitReservation to pass businessResourceId**

Replace the `context.read<CreateReservationCubit>().createReservation(...)` call in `_submitReservation`:

```dart
context.read<CreateReservationCubit>().createReservation(
  tenantSlug: widget.tenantSlug,
  clientResourceId: _selectedResource?.id,
  businessResourceId: _showBusinessResourceStep
      ? _selectedBusinessResourceId
      : null,
  serviceId: _selectedService!.id,
  scheduledAt: DateFormat('yyyy-MM-dd HH:mm:ss').format(_selectedSlot!.start),
  notes: _notesController.text.trim().isNotEmpty
      ? _notesController.text.trim()
      : null,
);
```

- [ ] **Step 5: Update StepIndicator call and PageView children**

Replace the `StepIndicator(...)` call:
```dart
StepIndicator(
  currentStep: _currentStep,
  totalSteps: _totalSteps,
  labels: _stepLabels,
  onStepTap: (i) {
    if (i <= _currentStep) _goToStep(i);
  },
),
```

Replace the `PageView` children list:
```dart
children: [
  if (_showBusinessResourceStep)
    _StepBusinessResource(
      businessResources: widget.businessResources,
      selectedId: _selectedBusinessResourceId,
      selectionMade: _businessResourceStepCompleted,
      onSelected: (id) {
        setState(() {
          _selectedBusinessResourceId = id;
          _businessResourceStepCompleted = true;
        });
        context.read<CreateReservationCubit>().selectBusinessResource(id);
      },
      onNext: () {
        if (_businessResourceStepCompleted) _nextStep();
      },
    ),
  if (!_skipResourceStep)
    _Step1ResourceSelection(
      selectedResource: _selectedResource,
      scrollController: _step1ScrollController,
      onResourceSelected: (r) {
        setState(() {
          _selectedResource = r;
          _resolvedVariant = null;
          _lastResolvedFor = null;
        });
        _resolveVariantForResource(r);
      },
      onCreateResource: () async {
        final result = await context.push(
          '/resources/add',
          extra: {
            'customFields': widget.customFields,
            'businessType': widget.businessType,
          },
        );
        if (result == true && mounted) {
          context.read<ResourcesCubit>().loadResources();
          await Future.delayed(const Duration(milliseconds: 500));
          if (mounted) {
            final state = context.read<ResourcesCubit>().state;
            if (state is ResourcesLoaded && state.resources.isNotEmpty) {
              final last = state.resources.last;
              setState(() {
                _selectedResource = last;
                _resolvedVariant = null;
                _lastResolvedFor = null;
              });
              _resolveVariantForResource(last);
            }
          }
        }
      },
      onEditResource: (resource) async {
        final result = await context.push(
          '/resources/add',
          extra: {
            'customFields': widget.customFields,
            'resource': resource,
            'businessType': widget.businessType,
          },
        );
        if (result == true && mounted) {
          context.read<ResourcesCubit>().loadResources();
        }
      },
      onDeleteResource: (resource) async {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text('Eliminar registro'),
            content: Text('Eliminar "${resource.label}"?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: TextButton.styleFrom(foregroundColor: AppColors.error),
                child: const Text('Eliminar'),
              ),
            ],
          ),
        );
        if (confirmed == true && mounted) {
          await context.read<ResourcesCubit>().deleteResource(resource.id);
          if (mounted && _selectedResource?.id == resource.id) {
            setState(() => _selectedResource = null);
          }
        }
      },
      onNext: () {
        if (_selectedResource != null) _nextStep();
      },
    ),
  _Step2DateSlot(
    services: widget.services,
    selectedService: _selectedService,
    hasPreselectedService: widget.serviceId != null,
    selectedDate: _selectedDate,
    selectedSlot: _selectedSlot,
    resolvedVariant: _resolvedVariant,
    resolvingVariant: _resolvingVariant,
    onChangeVariant: _pickVariantManually,
    onServiceSelected: (service) {
      setState(() {
        _selectedService = service;
        _selectedSlot = null;
        _resolvedVariant = null;
        _lastResolvedFor = null;
      });
      if (_selectedResource != null) {
        _resolveVariantForResource(_selectedResource!);
      }
      _loadSlots();
    },
    onDateSelected: (date) {
      setState(() {
        _selectedDate = date;
        _selectedSlot = null;
      });
      _loadSlots();
    },
    onSlotSelected: (slot) {
      setState(() => _selectedSlot = slot);
    },
    onNext: () {
      if (_selectedSlot != null) _nextStep();
    },
  ),
  _Step3Confirm(
    selectedResource: _selectedResource,
    selectedBusinessResourceName: _selectedBusinessResourceName,
    selectedService: _selectedService,
    selectedDate: _selectedDate,
    selectedSlot: _selectedSlot,
    notesController: _notesController,
    onSubmit: _submitReservation,
    availableServices: widget.services,
  ),
],
```

Also add the helper getter:
```dart
String? get _selectedBusinessResourceName {
  if (!_showBusinessResourceStep) return null;
  if (!_businessResourceStepCompleted) return null;
  if (_selectedBusinessResourceId == null) return 'Sin preferencia';
  return widget.businessResources
      .where((r) => r.id == _selectedBusinessResourceId)
      .map((r) => r.name)
      .firstOrNull;
}
```

- [ ] **Step 6: Add _StepBusinessResource widget at the bottom of the file**

Add after the `_ResourceCard` class (before `_Step2DateSlot`):

```dart
// -- Step Business Resource: Barber / Station / Room Selection --
class _StepBusinessResource extends StatelessWidget {
  final List<explore_resource.BusinessResource> businessResources;
  final String? selectedId; // null = sin preferencia
  final bool selectionMade;
  final ValueChanged<String?> onSelected; // null = sin preferencia
  final VoidCallback onNext;

  const _StepBusinessResource({
    required this.businessResources,
    required this.selectedId,
    required this.selectionMade,
    required this.onSelected,
    required this.onNext,
  });

  bool get _isSinPreferenciaSelected => selectionMade && selectedId == null;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '¿Con quién quieres reservar?',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ).animate().fadeIn(duration: 400.ms),
          const SizedBox(height: 4),
          const Text(
            'Elige o deja que asignemos automáticamente',
            style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
          ).animate().fadeIn(duration: 400.ms, delay: 50.ms),
          const SizedBox(height: 20),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.85,
            children: [
              // "Sin preferencia" card — always first
              _BusinessResourceCard(
                id: null,
                name: 'Sin preferencia',
                employeeName: null,
                employeePhotoUrl: null,
                isSelected: _isSinPreferenciaSelected,
                onTap: () => onSelected(null),
              ),
              // Resource cards
              ...businessResources.map(
                (r) => _BusinessResourceCard(
                  id: r.id,
                  name: r.name,
                  employeeName: r.employeeName,
                  employeePhotoUrl: r.employeePhotoUrl,
                  isSelected: selectionMade && selectedId == r.id,
                  onTap: () => onSelected(r.id),
                ),
              ),
            ],
          ).animate().fadeIn(duration: 400.ms, delay: 100.ms),

          const SizedBox(height: 32),
          AppButton(
            label: 'Siguiente',
            onPressed: selectionMade ? onNext : null,
            icon: Icons.arrow_forward_rounded,
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
        ],
      ),
    );
  }
}

class _BusinessResourceCard extends StatelessWidget {
  final String? id;
  final String name;
  final String? employeeName;
  final String? employeePhotoUrl;
  final bool isSelected;
  final VoidCallback onTap;

  const _BusinessResourceCard({
    required this.id,
    required this.name,
    required this.employeeName,
    required this.employeePhotoUrl,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final displayName = employeeName ?? name;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? primary.withValues(alpha: 0.06) : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? primary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            id == null
                ? Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isSelected
                          ? primary.withValues(alpha: 0.1)
                          : AppColors.divider,
                    ),
                    child: Icon(
                      Icons.person_search_rounded,
                      color: isSelected ? primary : AppColors.textTertiary,
                      size: 28,
                    ),
                  )
                : AvatarCircle(
                    name: displayName,
                    size: 56,
                    imageUrl: employeePhotoUrl,
                  ),
            const SizedBox(height: 8),
            Text(
              displayName,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isSelected ? primary : AppColors.textPrimary,
              ),
            ),
            if (isSelected) ...[
              const SizedBox(height: 4),
              Icon(Icons.check_circle_rounded, color: primary, size: 16),
            ],
          ],
        ),
      ),
    );
  }
}
```

Add the import for `AvatarCircle` at the top of the file:
```dart
import '../../../../shared/widgets/avatar_circle.dart';
```

And import `explore_resource` alias:
```dart
import '../../../explore/domain/entities/business_resource.dart' as explore_resource;
```

- [ ] **Step 7: Update router to pass new params**

In `apps/customer_v2/lib/app/router.dart`, add the import:
```dart
import '../features/explore/domain/entities/business_resource.dart' as explore_resource;
```

Replace the `CreateReservationScreen(...)` call (line 198):
```dart
return CreateReservationScreen(
  tenantSlug: extra?['tenantSlug'] as String? ?? '',
  serviceId: extra?['serviceId'] as String?,
  serviceVariantId: extra?['serviceVariantId'] as String?,
  services: services,
  customFields: customFields,
  businessType: extra?['businessType'] as String?,
  allowClientResourceSelection:
      extra?['allowClientResourceSelection'] as bool? ?? false,
  businessResources:
      (extra?['businessResources'] as List<explore_resource.BusinessResource>?) ?? [],
);
```

- [ ] **Step 8: Update business_detail_screen.dart to pass business resources**

In `apps/customer_v2/lib/features/business/presentation/screens/business_detail_screen.dart`, update the `context.push('/reservations/create', extra: {...})` call:

```dart
context.push('/reservations/create', extra: {
  'tenantSlug': business.slug,
  'serviceId': service.id,
  'serviceVariantId': null,
  'services': business.services,
  'customFields': business.customFields,
  'businessType': business.businessType,
  'allowClientResourceSelection': business.allowClientResourceSelection,
  'businessResources': business.businessResources,
});
```

- [ ] **Step 9: Run Flutter analyzer**

```bash
cd apps/customer_v2 && fvm flutter analyze lib/ 2>&1 | grep -E "error" | head -20
```
Expected: no errors. Fix any unused import warnings if present.

- [ ] **Step 10: Commit**

```bash
git add apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart \
        apps/customer_v2/lib/app/router.dart \
        apps/customer_v2/lib/features/business/presentation/screens/business_detail_screen.dart
git commit -m "feat(flutter): add business resource picker wizard step to booking flow"
```

---

### Task 7: Flutter — update _Step3Confirm to show selected business resource

**Files:**
- Modify: `apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart` (the `_Step3Confirm` class only)

**Interfaces:**
- Consumes: `String? selectedBusinessResourceName` from `_CreateReservationViewState._selectedBusinessResourceName` getter (Task 6)
- Produces: business resource row appears in confirm step summary when not null

- [ ] **Step 1: Add selectedBusinessResourceName to _Step3Confirm**

In the `_Step3Confirm` class definition, add one field:
```dart
class _Step3Confirm extends StatelessWidget {
  final ClientResource? selectedResource;
  final String? selectedBusinessResourceName;   // NEW
  final explore.Service? selectedService;
  // ... rest unchanged ...

  const _Step3Confirm({
    required this.selectedResource,
    this.selectedBusinessResourceName,          // NEW
    this.selectedService,
    // ... rest unchanged ...
  });
```

- [ ] **Step 2: Render the business resource row in the summary card**

In `_Step3Confirm.build()`, inside the summary card's `Column.children` list, add the business resource row before the date row. Find:

```dart
if (selectedResource != null) ...[
  _SummaryRow(
    icon: Icons.badge_outlined,
    label: 'Registro',
    value: selectedResource!.label,
  ),
  const Divider(height: 24),
],
```

Add BEFORE it:
```dart
if (selectedBusinessResourceName != null) ...[
  _SummaryRow(
    icon: Icons.person_outline_rounded,
    label: 'Atendido por',
    value: selectedBusinessResourceName!,
  ),
  const Divider(height: 24),
],
```

- [ ] **Step 3: Run Flutter analyzer**

```bash
cd apps/customer_v2 && fvm flutter analyze lib/features/reservations/ 2>&1 | grep -E "error" | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart
git commit -m "feat(flutter): show selected business resource in booking confirmation step"
```

---

## Manual Testing Checklist

After all tasks complete, test with a tenant that has `allow_client_resource_selection = true` and at least 2 active business resources:

- [ ] Open app → navigate to a business page → tap "Reservar"
- [ ] First wizard step is the resource picker showing a "Sin preferencia" card + resource cards
- [ ] "Siguiente" is disabled until a card is tapped
- [ ] Tap a specific resource card → step indicator advances → date step loads slots filtered for that resource
- [ ] Tap "Sin preferencia" → slot availability is unfiltered (general capacity)
- [ ] Complete booking with specific resource selected → confirm step shows "Atendido por: [name]"
- [ ] Complete booking with sin preferencia → confirm step shows "Atendido por: Sin preferencia"
- [ ] Open app → navigate to a business with `allow_client_resource_selection = false` → wizard has NO resource picker step (existing behavior preserved)
- [ ] If tenant has both custom_fields (vehicle registration) AND business resources: both steps appear (barber first, then vehicle)
