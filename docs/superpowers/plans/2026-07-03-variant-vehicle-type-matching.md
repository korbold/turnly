# Variant ↔ Vehicle-Type Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle keyword-substring variant auto-suggestion with a structured match where each service variant declares the vehicle types it covers, matched by exact membership, from a single backend source of truth.

**Architecture:** `service_variants` gains a `vehicle_types` JSON array (subset of the tenant's `affects_variant` custom-field options). The backend `VariantSuggester` matches `client_resource.data[<affects_variant key>]` by membership. The `affects_variant` field becomes system-locked (undeletable, options add-only) so labels never change and references never orphan. Admin edits `vehicle_types` per variant with a coverage indicator; the admin's duplicate keyword matcher is deleted and sources suggestions from the same backend rule. Mobile is unchanged (already consumes the backend endpoint with a manual-picker fallback).

**Tech Stack:** Laravel 13 + Pest (backend), Next.js 16 + React Query + TypeScript (admin-v2). Flutter (customer_v2) — no changes.

## Global Constraints

- Backend models live in `app/Infrastructure/Persistence/Models/` (not `app/Models/`).
- Use `config()` never `env()` in app code; prod runs `config:cache`.
- Multi-tenant: `TenantScope` auto-applies; `ServiceVariantModel` uses `BelongsToTenant` + `SoftDeletes` + `HasUuids`.
- Tests: Pest, SQLite in-memory, queue `sync`. Run with `php artisan test` from `apps/backend/`.
- Admin: read `node_modules/next/dist/docs/` before Next.js code (Next 16 breaking changes); snake_case API ↔ camelCase domain via mappers.
- `affects_variant` field per business_type (car_wash `vehicle_type`; barbershop `segment`; spa `gender`; medical `patient_segment`). Logic must stay vertical-agnostic — read the field flagged `affects_variant: true`, never hardcode `vehicle_type`.
- The canonical vocabulary = that field's `options` (human labels). `vehicle_types` values are those exact strings.

---

## File Structure

**Backend (`apps/backend/`):**
- `database/migrations/2026_07_03_000100_add_vehicle_types_to_service_variants.php` — Create
- `app/Infrastructure/Persistence/Models/ServiceVariantModel.php` — Modify (fillable + cast)
- `app/Infrastructure/Http/Resources/ServiceVariantResource.php` — Modify (expose field)
- `app/Infrastructure/Http/Controllers/Service/ServiceVariantController.php` — Modify (validate + persist)
- `app/Domain/Reservation/VariantSuggester.php` — Modify (membership match)
- `app/Domain/Tenant/BusinessTypeTemplates.php` — Modify (mark field `locked`, drop `variant_map`)
- `app/Domain/Tenant/LockedCustomFields.php` — Create (enforcement helper)
- `app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php` — Modify (enforce locks)
- `app/Console/Commands/BackfillVariantVehicleTypes.php` — Create (one-off backfill)
- `tests/Feature/Reservation/VariantSuggesterTest.php` — Create
- `tests/Feature/Service/ServiceVariantVehicleTypesTest.php` — Create
- `tests/Feature/Tenant/LockedCustomFieldsTest.php` — Create

**Admin (`apps/admin-v2/`):**
- `src/domain/entities/service-variant.ts` — Modify (`vehicleTypes`)
- `src/infrastructure/api/mappers/*` (service-variant mapper) — Modify (map field)
- `src/presentation/hooks/use-service-variants.ts` — Modify (input type + payload)
- `src/presentation/components/features/services/variant-editor.tsx` — Modify (multi-select + coverage)
- `src/presentation/components/features/services/variant-suggestion.tsx` — Modify (drop keyword map)
- `src/presentation/components/features/settings/custom-fields-tab.tsx` — Modify (lock field)

**Mobile:** none.

---

## Task 1: Add `vehicle_types` to service_variants (schema + model + resource)

**Files:**
- Create: `database/migrations/2026_07_03_000100_add_vehicle_types_to_service_variants.php`
- Modify: `app/Infrastructure/Persistence/Models/ServiceVariantModel.php:20-33`
- Modify: `app/Infrastructure/Http/Resources/ServiceVariantResource.php:14-21`

**Interfaces:**
- Produces: `ServiceVariantModel->vehicle_types` is `array` (cast), fillable. Resource emits `vehicle_types` as `string[]`.

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('service_variants', function (Blueprint $table) {
            $table->json('vehicle_types')->nullable()->after('label');
        });
    }

    public function down(): void
    {
        Schema::table('service_variants', function (Blueprint $table) {
            $table->dropColumn('vehicle_types');
        });
    }
};
```

- [ ] **Step 2: Add fillable + cast to the model**

In `ServiceVariantModel.php`, add `'vehicle_types'` to `$fillable` and the cast:

```php
    protected $fillable = [
        'tenant_id', 'service_id', 'label', 'vehicle_types',
        'price', 'duration_min', 'sort_order', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'vehicle_types' => 'array',
            'price'        => 'decimal:2',
            'duration_min' => 'integer',
            'sort_order'   => 'integer',
            'is_active'    => 'boolean',
        ];
    }
```

- [ ] **Step 3: Expose in the resource**

In `ServiceVariantResource.php`, after the `label` line add:

```php
            'label'         => $this->label,
            'vehicle_types' => $this->vehicle_types ?? [],
```

- [ ] **Step 4: Run migration on the test DB + a quick tinker check**

Run: `php artisan migrate --env=testing` then
Run: `php artisan test --filter=ServiceVariantVehicleTypesTest` (will fail until Task 2 — expected now: "no tests"). For this task, verify no migration error:
Run: `php artisan migrate:status`
Expected: the new migration listed as `Ran`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/database/migrations/2026_07_03_000100_add_vehicle_types_to_service_variants.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceVariantModel.php \
        apps/backend/app/Infrastructure/Http/Resources/ServiceVariantResource.php
git commit -m "feat(backend): add vehicle_types column to service_variants"
```

---

## Task 2: Validate + persist `vehicle_types` in ServiceVariantController

**Files:**
- Modify: `app/Infrastructure/Http/Controllers/Service/ServiceVariantController.php:26-78`
- Test: `tests/Feature/Service/ServiceVariantVehicleTypesTest.php`

**Interfaces:**
- Consumes: `ServiceVariantModel` (Task 1). The tenant's `affects_variant` field options via `TenantModel->custom_fields`.
- Produces: store/update accept `vehicle_types: string[]`; each value must be an option of the tenant's `affects_variant` field, else 422.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

function carWashTenant(): TenantModel {
    return TenantModel::factory()->create([
        'business_type' => 'car_wash',
        'custom_fields' => [[
            'key' => 'vehicle_type', 'label' => 'Tipo de vehículo', 'type' => 'select',
            'required' => true, 'affects_variant' => true, 'locked' => true,
            'options' => ['Sedán', 'Hatchback', 'SUV', 'Camioneta', 'Camión / Van'],
        ]],
    ]);
}

it('persists valid vehicle_types on a variant', function () {
    $tenant = carWashTenant();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $user = UserModel::factory()->create();

    $res = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->postJson("/api/services/{$service->id}/variants", [
            'label' => 'Auto', 'price' => 12, 'duration_min' => 40,
            'vehicle_types' => ['Sedán', 'Hatchback'],
        ]);

    $res->assertCreated();
    expect($res->json('data.vehicle_types'))->toEqual(['Sedán', 'Hatchback']);
});

it('rejects a vehicle_type not in the tenant options', function () {
    $tenant = carWashTenant();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $user = UserModel::factory()->create();

    $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->postJson("/api/services/{$service->id}/variants", [
            'label' => 'Auto', 'vehicle_types' => ['Moto'],
        ])
        ->assertStatus(422);
});
```

> Note: confirm the tenant-resolution header used by the test suite (`X-Tenant` / subdomain). If existing feature tests use a helper (e.g. `actingAsTenant($tenant)`), reuse it instead of the header above.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ServiceVariantVehicleTypesTest`
Expected: FAIL (vehicle_types ignored / not validated).

- [ ] **Step 3: Implement validation + persistence**

Replace the controller body's `store`, `update`, and `rules` to handle `vehicle_types`. Add a helper that reads the tenant's allowed options:

```php
    public function store(Request $request, string $serviceId): JsonResponse
    {
        $service = ServiceModel::findOrFail($serviceId);
        $data = $request->validate($this->rules());
        $this->assertVehicleTypesAllowed($service->tenant_id, $data['vehicle_types'] ?? []);

        $variant = ServiceVariantModel::create([
            'tenant_id'     => $service->tenant_id,
            'service_id'    => $service->id,
            'label'         => $data['label'],
            'vehicle_types' => $data['vehicle_types'] ?? [],
            'price'         => $data['price'] ?? 0,
            'duration_min'  => $data['duration_min'] ?? 30,
            'sort_order'    => $data['sort_order'] ?? 0,
            'is_active'     => $data['is_active'] ?? true,
        ]);

        $variant->load('consumption.product');
        return (new ServiceVariantResource($variant))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $variantId): ServiceVariantResource
    {
        $variant = ServiceVariantModel::findOrFail($variantId);
        $data = $request->validate($this->rules());
        if (array_key_exists('vehicle_types', $data)) {
            $this->assertVehicleTypesAllowed($variant->tenant_id, $data['vehicle_types'] ?? []);
        }

        $variant->update($data);
        $variant->load('consumption.product');
        return new ServiceVariantResource($variant);
    }

    private function rules(): array
    {
        return [
            'label'          => ['required', 'string', 'max:80'],
            'vehicle_types'  => ['nullable', 'array'],
            'vehicle_types.*' => ['string', 'max:80'],
            'price'          => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'duration_min'   => ['nullable', 'integer', 'min:1', 'max:1440'],
            'sort_order'     => ['nullable', 'integer'],
            'is_active'      => ['boolean'],
        ];
    }

    private function assertVehicleTypesAllowed(string $tenantId, array $types): void
    {
        if (empty($types)) return;
        $tenant = \App\Infrastructure\Persistence\Models\TenantModel::find($tenantId);
        $fields = is_array($tenant?->custom_fields) ? $tenant->custom_fields : [];
        $field = collect($fields)->first(fn ($f) => ($f['affects_variant'] ?? false) === true);
        $allowed = is_array($field['options'] ?? null) ? $field['options'] : [];
        $invalid = array_values(array_diff($types, $allowed));
        if (!empty($invalid)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'vehicle_types' => 'Tipos no válidos: ' . implode(', ', $invalid),
            ]);
        }
    }
```

Keep the existing `use` imports; add `use Illuminate\Validation\ValidationException;` if you prefer over the FQCN above.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=ServiceVariantVehicleTypesTest`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Service/ServiceVariantController.php \
        apps/backend/tests/Feature/Service/ServiceVariantVehicleTypesTest.php
git commit -m "feat(backend): validate + persist vehicle_types on service variants"
```

---

## Task 3: Rewrite VariantSuggester to membership match

**Files:**
- Modify: `app/Domain/Reservation/VariantSuggester.php` (replace `suggest` body)
- Test: `tests/Feature/Reservation/VariantSuggesterTest.php`

**Interfaces:**
- Consumes: `ServiceVariantModel->vehicle_types` (Task 1); the tenant's `affects_variant` field `key`.
- Produces: `suggest(ClientResourceModel, Collection<ServiceVariantModel>, array $customFields): ?ServiceVariantModel` — returns the first active variant (by `sort_order`) whose `vehicle_types` contains `resource.data[key]`, else `null`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Domain\Reservation\VariantSuggester;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Support\Collection;

function fields(): array {
    return [[
        'key' => 'vehicle_type', 'affects_variant' => true,
        'options' => ['Sedán', 'Hatchback', 'SUV', 'Camioneta'],
    ]];
}

function variant(string $label, array $types, int $sort = 0, bool $active = true): ServiceVariantModel {
    return new ServiceVariantModel([
        'label' => $label, 'vehicle_types' => $types, 'sort_order' => $sort, 'is_active' => $active,
    ]);
}

it('matches a variant whose vehicle_types contains the resource value', function () {
    $resource = new ClientResourceModel(['data' => ['vehicle_type' => 'Hatchback']]);
    $variants = new Collection([
        variant('Auto', ['Sedán', 'Hatchback'], 0),
        variant('Camioneta/SUV', ['SUV', 'Camioneta'], 1),
    ]);

    $result = (new VariantSuggester())->suggest($resource, $variants, fields());
    expect($result?->label)->toBe('Auto');
});

it('returns null when no variant covers the value', function () {
    $resource = new ClientResourceModel(['data' => ['vehicle_type' => 'Camión / Van']]);
    $variants = new Collection([variant('Auto', ['Sedán'], 0)]);
    expect((new VariantSuggester())->suggest($resource, $variants, fields()))->toBeNull();
});

it('returns null when the resource has no segmentation value', function () {
    $resource = new ClientResourceModel(['data' => ['brand' => 'Kia']]);
    $variants = new Collection([variant('Auto', ['Sedán'], 0)]);
    expect((new VariantSuggester())->suggest($resource, $variants, fields()))->toBeNull();
});

it('skips inactive variants and prefers lower sort_order', function () {
    $resource = new ClientResourceModel(['data' => ['vehicle_type' => 'SUV']]);
    $variants = new Collection([
        variant('Inactiva', ['SUV'], 0, false),
        variant('Grande', ['SUV'], 2),
        variant('Mediano', ['SUV'], 1),
    ]);
    expect((new VariantSuggester())->suggest($resource, $variants, fields())?->label)->toBe('Mediano');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=VariantSuggesterTest`
Expected: FAIL (old keyword logic matches by label substring, not membership).

- [ ] **Step 3: Rewrite `suggest`**

Replace the `suggest` method body in `VariantSuggester.php` (keep the class, namespace, imports, and docblock intent updated):

```php
    public function suggest(
        ClientResourceModel $resource,
        Collection $variants,
        array $customFields,
    ): ?ServiceVariantModel {
        $field = collect($customFields)->first(
            fn (array $f) => ($f['affects_variant'] ?? false) === true,
        );
        if (!$field) return null;

        $key = $field['key'] ?? null;
        if (!$key) return null;

        $resourceData = $resource->data ?? [];
        if (!is_array($resourceData)) $resourceData = (array) $resourceData;

        $value = $resourceData[$key] ?? null;
        if (!is_string($value) || $value === '') return null;

        return $variants
            ->filter(fn ($v) => $v->is_active)
            ->sortBy('sort_order')
            ->first(function ($v) use ($value) {
                $types = $v->vehicle_types ?? [];
                return is_array($types) && in_array($value, $types, true);
            });
    }
```

Update the docblock: match is now exact membership of the field value in `service_variants.vehicle_types` (no keywords).

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=VariantSuggesterTest`
Expected: PASS (all four).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Domain/Reservation/VariantSuggester.php \
        apps/backend/tests/Feature/Reservation/VariantSuggesterTest.php
git commit -m "feat(backend): match variant by vehicle_types membership (drop keywords)"
```

---

## Task 4: Lock the affects_variant field in templates + enforcement helper

**Files:**
- Modify: `app/Domain/Tenant/BusinessTypeTemplates.php:33-95` (all `affects_variant` fields)
- Create: `app/Domain/Tenant/LockedCustomFields.php`
- Test: `tests/Feature/Tenant/LockedCustomFieldsTest.php`

**Interfaces:**
- Produces: `LockedCustomFields::reconcile(array $incoming, array $existing): array` — returns the incoming fields with locked fields (`affects_variant === true`) protected: locked field cannot be dropped (re-injected from existing), its `key`/`type`/`affects_variant` restored from existing, and its `options` must be a superset of existing options (add-only) or a `ValidationException` is thrown.

- [ ] **Step 1: Mark template fields locked, drop variant_map**

In `BusinessTypeTemplates::getCustomFields`, for each `affects_variant => true` field: add `'locked' => true` and remove the `'variant_map' => [...]` entry. Example for car_wash:

```php
                [
                    'key' => 'vehicle_type',
                    'label' => 'Tipo de vehículo',
                    'type' => 'select',
                    'required' => true,
                    'options' => ['Sedán', 'Hatchback', 'SUV', 'Camioneta', 'Camión / Van'],
                    'affects_variant' => true,
                    'locked' => true,
                ],
```

Do the same for `barbershop.segment`, `spa.gender`, `medical.patient_segment` (add `'locked' => true`, delete `variant_map`). Update the class docblock: `variant_map` removed; matching now uses `service_variants.vehicle_types`.

- [ ] **Step 2: Write the failing test**

```php
<?php

use App\Domain\Tenant\LockedCustomFields;
use Illuminate\Validation\ValidationException;

function lockedField(array $options): array {
    return ['key' => 'vehicle_type', 'label' => 'Tipo de vehículo', 'type' => 'select',
            'required' => true, 'affects_variant' => true, 'locked' => true, 'options' => $options];
}

it('re-injects a locked field the client tried to drop', function () {
    $existing = [lockedField(['Sedán', 'SUV'])];
    $result = LockedCustomFields::reconcile([], $existing);
    expect($result)->toHaveCount(1)
        ->and($result[0]['key'])->toBe('vehicle_type');
});

it('allows appending new options to a locked field', function () {
    $existing = [lockedField(['Sedán', 'SUV'])];
    $incoming = [lockedField(['Sedán', 'SUV', 'Moto'])];
    $result = LockedCustomFields::reconcile($incoming, $existing);
    expect($result[0]['options'])->toEqual(['Sedán', 'SUV', 'Moto']);
});

it('rejects removing or renaming a seeded option', function () {
    $existing = [lockedField(['Sedán', 'SUV'])];
    $incoming = [lockedField(['Sedan', 'SUV'])]; // renamed Sedán -> Sedan
    expect(fn () => LockedCustomFields::reconcile($incoming, $existing))
        ->toThrow(ValidationException::class);
});

it('leaves non-locked fields untouched', function () {
    $existing = [lockedField(['Sedán'])];
    $incoming = [
        lockedField(['Sedán']),
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true],
    ];
    $result = LockedCustomFields::reconcile($incoming, $existing);
    expect($result)->toHaveCount(2)->and($result[1]['key'])->toBe('plate');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=LockedCustomFieldsTest`
Expected: FAIL ("Class LockedCustomFields not found").

- [ ] **Step 4: Implement the helper**

```php
<?php

declare(strict_types=1);

namespace App\Domain\Tenant;

use Illuminate\Validation\ValidationException;

final class LockedCustomFields
{
    /**
     * Protect locked custom fields (affects_variant === true) on tenant update.
     * Locked fields cannot be removed; their key/type/affects_variant are
     * restored from the existing record; options are add-only (superset).
     *
     * @param array<int, array<string, mixed>> $incoming
     * @param array<int, array<string, mixed>> $existing
     * @return array<int, array<string, mixed>>
     */
    public static function reconcile(array $incoming, array $existing): array
    {
        $lockedExisting = array_values(array_filter(
            $existing,
            fn ($f) => ($f['affects_variant'] ?? false) === true,
        ));

        foreach ($lockedExisting as $locked) {
            $key = $locked['key'];
            $idx = self::indexOfKey($incoming, $key);

            if ($idx === null) {
                // Client dropped it — re-inject the protected field.
                $incoming[] = $locked;
                continue;
            }

            $seeded = is_array($locked['options'] ?? null) ? $locked['options'] : [];
            $submitted = is_array($incoming[$idx]['options'] ?? null) ? $incoming[$idx]['options'] : [];
            $removed = array_values(array_diff($seeded, $submitted));
            if (!empty($removed)) {
                throw ValidationException::withMessages([
                    'custom_fields' => 'No se pueden renombrar ni eliminar las opciones fijas de "'
                        . ($locked['label'] ?? $key) . '": ' . implode(', ', $removed),
                ]);
            }

            // Restore locked attributes; keep submitted (superset) options + label edits allowed only on non-seeded parts.
            $incoming[$idx]['key'] = $locked['key'];
            $incoming[$idx]['type'] = $locked['type'];
            $incoming[$idx]['affects_variant'] = true;
            $incoming[$idx]['locked'] = true;
        }

        return array_values($incoming);
    }

    private static function indexOfKey(array $fields, string $key): ?int
    {
        foreach ($fields as $i => $f) {
            if (($f['key'] ?? null) === $key) return $i;
        }
        return null;
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=LockedCustomFieldsTest`
Expected: PASS (all four).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Domain/Tenant/BusinessTypeTemplates.php \
        apps/backend/app/Domain/Tenant/LockedCustomFields.php \
        apps/backend/tests/Feature/Tenant/LockedCustomFieldsTest.php
git commit -m "feat(backend): lock affects_variant fields (add-only options), drop variant_map seeding"
```

---

## Task 5: Enforce locks in TenantSettingsController

**Files:**
- Modify: `app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php:46-60`
- Test: add cases to `tests/Feature/Tenant/LockedCustomFieldsTest.php` (HTTP-level)

**Interfaces:**
- Consumes: `LockedCustomFields::reconcile` (Task 4).
- Produces: `PATCH /tenant/settings` (or the route mapped to `update`) passes `custom_fields` through `reconcile` against the tenant's current `custom_fields` before saving.

- [ ] **Step 1: Write the failing HTTP test**

```php
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

it('rejects deleting a locked field via the settings endpoint', function () {
    $tenant = TenantModel::factory()->create([
        'business_type' => 'car_wash',
        'custom_fields' => [lockedField(['Sedán', 'SUV'])],
    ]);
    $user = UserModel::factory()->create();

    // Attempt to overwrite custom_fields without the locked field
    $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson('/api/tenant/settings', [
            'custom_fields' => [['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true]],
        ])
        ->assertOk();

    $tenant->refresh();
    $keys = collect($tenant->custom_fields)->pluck('key');
    expect($keys)->toContain('vehicle_type'); // re-injected, not dropped
});
```

> Confirm the exact settings route + verb (`grep -rn "tenant/settings\|TenantSettingsController" routes/`). Adjust `patchJson` path/method to match.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=LockedCustomFieldsTest`
Expected: FAIL (locked field dropped — `vehicle_type` missing after save).

- [ ] **Step 3: Wire reconcile into update()**

In `TenantSettingsController::update`, before `$tenant->update(...)`, reconcile incoming custom_fields against existing:

```php
        $tenant = TenantModel::findOrFail(app('current_tenant_id'));

        if ($request->has('custom_fields')) {
            $reconciled = \App\Domain\Tenant\LockedCustomFields::reconcile(
                $request->input('custom_fields') ?? [],
                is_array($tenant->custom_fields) ? $tenant->custom_fields : [],
            );
            $request->merge(['custom_fields' => $reconciled]);
        }

        $tenant->update($request->only([
            'name', 'description', 'address', 'phone', 'business_type',
            'custom_fields', 'social_links', 'brand_theme',
            'onboarding_step', 'logo_url', 'cover_url',
        ]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=LockedCustomFieldsTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php \
        apps/backend/tests/Feature/Tenant/LockedCustomFieldsTest.php
git commit -m "feat(backend): enforce locked custom fields on tenant settings update"
```

---

## Task 6: Backfill existing variants' vehicle_types from legacy variant_map

**Files:**
- Create: `app/Console/Commands/BackfillVariantVehicleTypes.php`

**Interfaces:**
- Consumes: tenants' stored `custom_fields[].variant_map` (legacy, still in prod data) + `service_variants.label`.
- Produces: sets `vehicle_types` on variants where empty, using the old keyword rule; logs variants left empty. Idempotent (skips variants that already have `vehicle_types`).

- [ ] **Step 1: Implement the command**

```php
<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Console\Command;

class BackfillVariantVehicleTypes extends Command
{
    protected $signature = 'variants:backfill-vehicle-types {--dry-run}';
    protected $description = 'Populate service_variants.vehicle_types from legacy variant_map keyword matching';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $filled = 0; $empty = 0;

        foreach (TenantModel::all() as $tenant) {
            $fields = is_array($tenant->custom_fields) ? $tenant->custom_fields : [];
            $field = collect($fields)->first(fn ($f) => ($f['affects_variant'] ?? false) === true);
            $map = is_array($field['variant_map'] ?? null) ? $field['variant_map'] : [];
            if (empty($map)) continue;

            $variants = ServiceVariantModel::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)->get();

            foreach ($variants as $variant) {
                if (!empty($variant->vehicle_types)) continue;
                $label = mb_strtolower((string) $variant->label);

                $types = [];
                foreach ($map as $optionValue => $keywords) {
                    foreach ((array) $keywords as $kw) {
                        if ($kw !== '' && str_contains($label, mb_strtolower((string) $kw))) {
                            $types[] = $optionValue;
                            break;
                        }
                    }
                }
                $types = array_values(array_unique($types));

                if (empty($types)) {
                    $empty++;
                    $this->warn("EMPTY  {$tenant->slug} / {$variant->label} ({$variant->id})");
                    continue;
                }
                $filled++;
                $this->line("FILL   {$tenant->slug} / {$variant->label} -> " . implode(', ', $types));
                if (!$dry) $variant->update(['vehicle_types' => $types]);
            }
        }

        $this->info(($dry ? '[dry-run] ' : '') . "Filled {$filled}, left empty {$empty} (need manual tagging).");
        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Verify it registers + dry-run locally**

Run: `php artisan variants:backfill-vehicle-types --dry-run`
Expected: prints FILL/EMPTY lines and a summary, no DB writes.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/Console/Commands/BackfillVariantVehicleTypes.php
git commit -m "feat(backend): backfill command for variant vehicle_types from legacy variant_map"
```

> Deployment note (not a code step): run `php artisan variants:backfill-vehicle-types` once on dev, review EMPTY lines, then on prod after merge to main. EMPTY variants must be tagged manually in the admin (Task 8).

---

## Task 7: Admin — add vehicleTypes to entity, mapper, and variant hook

**Files:**
- Modify: `src/domain/entities/service-variant.ts:15-27`
- Modify: the service-variant mapper (find: `grep -rln "durationMin\|duration_min" src/infrastructure/api/mappers/`)
- Modify: `src/presentation/hooks/use-service-variants.ts`

**Interfaces:**
- Produces: `ServiceVariant.vehicleTypes: string[]`; create/update input type gains `vehicleTypes: string[]`; API payload includes `vehicle_types`.

- [ ] **Step 1: Add to the entity**

In `service-variant.ts`, add to the `ServiceVariant` interface after `label`:

```ts
export interface ServiceVariant {
  id: string;
  serviceId: string;
  label: string;
  vehicleTypes: string[];
  price: number;
  durationMin: number;
  sortOrder: number;
  isActive: boolean;
  consumption?: BomLine[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

- [ ] **Step 2: Map the field (both directions)**

In the service-variant mapper, when mapping API → domain add `vehicleTypes: dto.vehicle_types ?? []`; when mapping domain input → API payload add `vehicle_types: input.vehicleTypes ?? []`. (Follow the file's existing mapping style.)

- [ ] **Step 3: Extend the create/update input type in the hook**

In `use-service-variants.ts`, find the input type used by `useCreateVariant`/`useUpdateVariant` (currently `{ label: string; price: number; durationMin: number }`) and add `vehicleTypes: string[]`. Ensure the mutation passes `vehicle_types` in the request body (via the mapper from Step 2).

- [ ] **Step 4: Type-check**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: no new type errors (existing callers may need `vehicleTypes: []` added — fixed in Task 8).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/domain/entities/service-variant.ts \
        apps/admin-v2/src/infrastructure/api/mappers/ \
        apps/admin-v2/src/presentation/hooks/use-service-variants.ts
git commit -m "feat(admin): thread vehicleTypes through variant entity, mapper, hook"
```

---

## Task 8: Admin — vehicle-type multi-select + coverage indicator in variant-editor

**Files:**
- Modify: `src/presentation/components/features/services/variant-editor.tsx`

**Interfaces:**
- Consumes: `ServiceVariant.vehicleTypes` (Task 7); the tenant's `affects_variant` field options via `useSettings()` (`settings.customFields`).
- Produces: variant create/edit form includes a checkbox group of the field options; a coverage summary lists uncovered options.

- [ ] **Step 1: Load the affects_variant options**

At the top of `VariantEditor`, derive the option list from settings:

```tsx
import { useSettings } from '@/presentation/hooks/use-settings';
// ...
  const { data: settings } = useSettings();
  const variantField = settings?.customFields?.find((f) => f.affectsVariant === true);
  const vehicleOptions = variantField?.options ?? [];
```

> If `CustomField` in `src/domain/entities/tenant.ts` lacks `affectsVariant`, add `affectsVariant?: boolean` to it and map it in the tenant mapper (snake `affects_variant`). Include this in the commit.

- [ ] **Step 2: Add vehicleTypes to form state + save**

Extend `VariantFormState` and `emptyForm`/`startEdit`/`save`:

```tsx
interface VariantFormState { label: string; price: string; durationMin: string; vehicleTypes: string[]; }
function emptyForm(): VariantFormState { return { label: '', price: '0', durationMin: '30', vehicleTypes: [] }; }
// startEdit: vehicleTypes: v.vehicleTypes ?? []
// save input: { label, price, durationMin, vehicleTypes: form.vehicleTypes }
```

- [ ] **Step 3: Render the checkbox group (only when options exist)**

Inside the dialog, after the price/duration grid:

```tsx
{vehicleOptions.length > 0 && (
  <div>
    <Label className="mb-1.5">Tipos de vehículo que cubre</Label>
    <div className="flex flex-wrap gap-2">
      {vehicleOptions.map((opt) => {
        const active = form.vehicleTypes.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => setForm((f) => ({
              ...f,
              vehicleTypes: active
                ? f.vehicleTypes.filter((t) => t !== opt)
                : [...f.vehicleTypes, opt],
            }))}
            className={active
              ? 'rounded-full border border-[var(--brand-600)] bg-[var(--brand-50)] px-3 py-1 text-[12px] text-[var(--brand-700)]'
              : 'rounded-full border border-[var(--border)] px-3 py-1 text-[12px] text-[var(--fg-secondary)]'}
          >
            {opt}
          </button>
        );
      })}
    </div>
    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
      Sin selección, esta variante nunca se auto-sugiere.
    </p>
  </div>
)}
```

- [ ] **Step 4: Coverage indicator on the list**

Above the variant list, compute and render uncovered options:

```tsx
const covered = new Set((variants ?? []).flatMap((v) => v.vehicleTypes ?? []));
const uncovered = vehicleOptions.filter((o) => !covered.has(o));
// render when uncovered.length > 0:
{uncovered.length > 0 && (
  <div className="rounded-lg border border-[var(--warning-200,#f5d5a8)] bg-[var(--warning-50,#fff8ec)] p-2 text-[12px] text-[var(--fg-secondary)]">
    Sin variante para: <strong>{uncovered.join(', ')}</strong>. Esos clientes verán el selector manual.
  </div>
)}
```

- [ ] **Step 5: Verify build + manual check**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run lint`
Expected: clean.
Manual: open a car_wash service, create a variant, toggle types, save; reopen — types persist; uncovered banner reflects gaps.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/services/variant-editor.tsx \
        apps/admin-v2/src/domain/entities/tenant.ts \
        apps/admin-v2/src/infrastructure/api/mappers/
git commit -m "feat(admin): tag variants with vehicle types + coverage indicator"
```

---

## Task 9: Admin — replace keyword matcher in variant-suggestion with membership

**Files:**
- Modify: `src/presentation/components/features/services/variant-suggestion.tsx`

**Interfaces:**
- Consumes: `ServiceVariant.vehicleTypes` (Task 7); the vehicle's type value.
- Produces: `findSuggestedVariant` returns the first variant whose `vehicleTypes` includes the vehicle type; removes `SIZE_BY_VEHICLE_TYPE`.

- [ ] **Step 1: Delete SIZE_BY_VEHICLE_TYPE and rewrite the finder**

Replace the keyword constant + `findSuggestedVariant` with membership logic:

```tsx
function findSuggestedVariant(vehicle: Vehicle, variants: ServiceVariant[]): ServiceVariant | null {
  const type = vehicle?.type?.trim();
  if (!type) return null;
  const match = [...variants]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((v) => (v.vehicleTypes ?? []).includes(type));
  return match ?? null;
}
```

Keep the component's props, gating, and render. Update the docblock: match is exact membership against `vehicleTypes` (no keyword overlap). Ensure `Vehicle.type` carries the stored `vehicle_type` value (the option label) — confirm at the call site that it passes `resource.data.vehicle_type`.

- [ ] **Step 2: Type-check + lint**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run lint`
Expected: clean (no references to the removed constant).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/services/variant-suggestion.tsx
git commit -m "refactor(admin): variant suggestion uses vehicleTypes membership, drop keyword map"
```

---

## Task 10: Admin — lock the affects_variant field row in custom-fields-tab

**Files:**
- Modify: `src/presentation/components/features/settings/custom-fields-tab.tsx`

**Interfaces:**
- Consumes: `CustomField.affectsVariant` / a `locked` flag (from Task 8 entity change).
- Produces: the locked field renders read-only for label/type/delete; its options input is add-only (cannot remove/rename seeded values, can append).

- [ ] **Step 1: Detect locked fields**

In the `.map` over `fields`, compute `const locked = field.affectsVariant === true || field.locked === true;` and capture the seeded (original) options for that key from `settings?.customFields` so removals can be blocked.

- [ ] **Step 2: Disable destructive controls for locked fields**

- Hide/disable the `removeField` trash button when `locked`.
- Disable the label `Input` and type `Select` when `locked`.
- For the options input when `locked`: on change, reject edits that drop a seeded option (keep them), allow appends. Show a hint "Opciones base fijas; puedes agregar nuevas."

```tsx
{locked ? (
  <Input
    value={field.options?.join(', ') ?? ''}
    onChange={(e) => {
      const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
      const seeded = seededOptionsFor(field.key); // from original settings
      const missing = seeded.filter((o) => !next.includes(o));
      if (missing.length) { toast.error(`No puedes quitar: ${missing.join(', ')}`); return; }
      updateField(idx, { options: next });
    }}
  />
) : (
  /* existing options input */
)}
```

- [ ] **Step 3: Verify build + manual check**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run lint`
Expected: clean.
Manual: in a car_wash tenant Settings → custom fields, the "Tipo de vehículo" field cannot be deleted, its label/type are disabled, seeded options can't be removed, a new option (e.g. "Moto") can be added and saved (backend Task 5 accepts it).

- [ ] **Step 4: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/settings/custom-fields-tab.tsx
git commit -m "feat(admin): lock affects_variant custom field (add-only options)"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** schema (T1), variant CRUD validation (T2), backend match (T3), template lock + helper (T4), settings enforcement (T5), backfill (T6), admin entity/mapper/hook (T7), admin editor + coverage (T8), admin suggestion dedup (T9), admin field lock (T10). Mobile: no change (spec). ✅
- **Vertical-agnostic:** T2/T3/T4/T8 all read the `affects_variant` field, never hardcode `vehicle_type`. ✅
- **Type consistency:** `vehicleTypes: string[]` (domain) ↔ `vehicle_types` (API) used consistently across T7–T10; `VariantSuggester::suggest` signature unchanged. ✅
- **Open confirmations flagged inline:** tenant-resolution test helper (T2/T5), settings route verb (T5), presence of `affectsVariant` on `CustomField` (T8), variant mapper file path (T7). Resolve each with the grep noted at that step before writing code.
