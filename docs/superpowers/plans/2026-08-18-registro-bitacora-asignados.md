# Lavador, secador y bitácora del servicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar quién lavó y quién secó cada servicio del Registro Diario, y dejar una bitácora append-only de todo lo que le pasa al registro, para poder defender un reclamo del dueño del vehículo semanas después.

**Architecture:** Los lavadores y secadores son un catálogo de nombres (`service_staff`), no usuarios de la app — eso deja intacta la columna `attended_by` y su regla anti-fraude. Dos columnas nuevas en `service_logs` apuntan al catálogo. La bitácora es una tabla append-only (`service_log_events`) escrita desde un único servicio con un método tipado por evento, invocado desde los siete puntos donde el registro cambia.

**Tech Stack:** Laravel 13 (clean architecture: Domain → Application → Infrastructure), Pest + SQLite en memoria, Next.js 16 + React Query + shadcn/ui, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-18-registro-bitacora-asignados-design.md`

## Global Constraints

- **Solo `car_wash`.** Toda UI y todo gate nuevo se activa únicamente cuando el tenant tiene `business_type === 'car_wash'`. En los demás rubros el comportamiento actual no cambia en absoluto.
- **`attended_by` no se toca.** Ni su tipo, ni su nullability, ni `resolveAttendedBy()`. `CashierAttributionTest` tiene que quedar verde sin editarlo — es la prueba de que el pin sobrevivió.
- **La bitácora no se edita ni se borra.** Modelos con `$timestamps = false` y `public const UPDATED_AT = null`. No hay endpoint de update ni de delete para eventos.
- **El catálogo no se borra.** Solo `is_active`. No existe ruta DELETE para `service_staff`.
- **Claves de la matriz de permisos congeladas.** El privilegio nuevo se llama exactamente `Asignados` (con mayúscula inicial, sin tilde en la clave persistida) y vive en el mismo mapa que `Precio` y `Eliminar`. Renombrarlo rompe la configuración guardada de los tenants.
- **Backend:** modelos en `app/Infrastructure/Persistence/Models/`, no en `app/Models/`. Todo modelo con tenant usa `use HasUuids, BelongsToTenant;`.
- **`config()` no `env()`** en código de aplicación (producción usa `config:cache`).
- **Tests:** `./vendor/bin/pest <ruta>` desde `apps/backend/`. Hay **9 fallos pre-existentes** en la suite (5 en `ClientResourceTest`, 3 en `ReservationInvoiceTest`, 1 en `ServiceLogTest > create service log requires required fields`). No son tuyos, no los arregles, no los cuentes como regresión.
- **Admin:** `npx tsc --noEmit` tiene que pasar limpio antes de cualquier commit que toque `apps/admin-v2`. La suite de lint tiene 48 errores pre-existentes (efectos con setState); no agregues ninguno nuevo en los archivos que toques.

---

### Task 1: Tabla y modelo del catálogo `service_staff`

**Files:**
- Create: `apps/backend/database/migrations/2026_08_18_100001_create_service_staff_table.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/ServiceStaffModel.php`
- Test: `apps/backend/tests/Feature/ServiceStaff/ServiceStaffModelTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: `ServiceStaffModel` con `$fillable = ['tenant_id','name','position','is_active']`, constantes `POSITION_WASHER = 'washer'`, `POSITION_DRYER = 'dryer'`, `POSITION_BOTH = 'both'`, y scope `scopeForPosition(Builder $q, string $position): Builder` que devuelve los activos cuyo `position` es el pedido o `both`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceStaff/ServiceStaffModelTest.php

use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('a staff member is created active by default', function () {
    $staff = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Federman Paspuel',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);

    expect($staff->is_active)->toBeTrue();
    expect($staff->position)->toBe('washer');
});

test('forPosition returns the exact position plus both, active only', function () {
    $washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);
    $dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis',
        'position'  => ServiceStaffModel::POSITION_DRYER,
    ]);
    $both = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Jorge',
        'position'  => ServiceStaffModel::POSITION_BOTH,
    ]);
    $inactive = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Renunció',
        'position'  => ServiceStaffModel::POSITION_WASHER, 'is_active' => false,
    ]);

    $ids = ServiceStaffModel::forPosition(ServiceStaffModel::POSITION_WASHER)
        ->pluck('id')->all();

    expect($ids)->toContain($washer->id)
        ->toContain($both->id)
        ->not->toContain($dryer->id)
        ->not->toContain($inactive->id);
});

test('the tenant scope hides another tenants staff', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    ServiceStaffModel::create([
        'tenant_id' => $other->id, 'name' => 'Ajeno',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);
    ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Propio',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);

    expect(ServiceStaffModel::pluck('name')->all())->toBe(['Propio']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceStaff/ServiceStaffModelTest.php`
Expected: FAIL — `Class "App\Infrastructure\Persistence\Models\ServiceStaffModel" not found`

- [ ] **Step 3: Write the migration**

```php
<?php
// apps/backend/database/migrations/2026_08_18_100001_create_service_staff_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catálogo de personal que ejecuta el trabajo sin ser usuario de la app:
     * en una lavadora, quién lava y quién seca. No son cuentas — no tienen
     * login, no cuentan contra max_employees del plan, y agregar uno es
     * escribir un nombre.
     *
     * Nombre genérico a propósito: el mismo shape sirve para barbero/ayudante
     * si otro rubro lo pide. Las etiquetas en español viven en la UI.
     *
     * Sin borrado: is_active saca a alguien de los selects sin romper el
     * historial de los servicios que ya hizo, que es justamente el punto.
     */
    public function up(): void
    {
        Schema::create('service_staff', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name', 120);
            $table->string('position', 20)->default('both');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->index(['tenant_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_staff');
    }
};
```

Nota: `position` es `string(20)` y no `enum` porque SQLite (los tests) no
soporta `ALTER` sobre enums y agregar un puesto nuevo obligaría a una
migración imposible de correr en el entorno de test. La validación vive en el
request.

- [ ] **Step 4: Write the model**

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/ServiceStaffModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Personal que ejecuta el servicio sin tener cuenta en la app.
 * Ver el spec: es lo que permite dejar `attended_by` (y su regla
 * anti-fraude) sin tocar.
 */
class ServiceStaffModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'service_staff';

    public const POSITION_WASHER = 'washer';
    public const POSITION_DRYER  = 'dryer';
    public const POSITION_BOTH   = 'both';

    public const POSITIONS = [
        self::POSITION_WASHER,
        self::POSITION_DRYER,
        self::POSITION_BOTH,
    ];

    protected $fillable = ['tenant_id', 'name', 'position', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * Los que pueden ocupar un puesto: quien lo tiene asignado, más quien
     * hace ambos. Solo activos — un select no ofrece a alguien que renunció.
     */
    public function scopeForPosition(Builder $query, string $position): Builder
    {
        return $query->where('is_active', true)
            ->whereIn('position', [$position, self::POSITION_BOTH]);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceStaff/ServiceStaffModelTest.php`
Expected: PASS — 3 passed

- [ ] **Step 6: Commit**

```bash
git add apps/backend/database/migrations/2026_08_18_100001_create_service_staff_table.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceStaffModel.php \
        apps/backend/tests/Feature/ServiceStaff/ServiceStaffModelTest.php
git commit -m "feat(service-staff): a catalog of people who do the work without an account"
```

---

### Task 2: Endpoints del catálogo, con la escritura gateada

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/ServiceStaff/ServiceStaffController.php`
- Create: `apps/backend/app/Infrastructure/Http/Resources/ServiceStaffResource.php`
- Modify: `apps/backend/routes/api.php` (dentro del grupo staff, junto a las rutas de `service-logs`)
- Test: `apps/backend/tests/Feature/ServiceStaff/ServiceStaffCrudTest.php`

**Interfaces:**
- Consumes: `ServiceStaffModel` de Task 1.
- Produces: `GET /api/v1/service-staff` (query opcional `?position=washer|dryer`), `POST /api/v1/service-staff`, `PATCH /api/v1/service-staff/{id}`. Payload y respuesta en snake_case: `{id, name, position, is_active, created_at}`.

Sin DTO ni UseCase: es un catálogo de tres campos sin lógica de dominio, y
`ServiceLogController` ya sienta el precedente de trabajar el modelo directo.
`BusinessResourceController` usa DTO+UseCase porque su alta tiene reglas; ésta
no tiene ninguna.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceStaff/ServiceStaffCrudTest.php

use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner   = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('an owner creates a staff member', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-staff', [
            'name' => 'Federman Paspuel', 'position' => 'washer',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.name', 'Federman Paspuel')
        ->assertJsonPath('data.position', 'washer')
        ->assertJsonPath('data.is_active', true);
});

test('a cashier cannot create a staff member', function () {
    ($this->as)($this->cashier)
        ->postJson('/api/v1/service-staff', ['name' => 'Federman', 'position' => 'washer'])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'FORBIDDEN');

    expect(ServiceStaffModel::count())->toBe(0);
});

test('a cashier can read the catalog because the select needs it', function () {
    ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/service-staff')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('the list filters by position and includes both', function () {
    foreach ([['Federman', 'washer'], ['Luis', 'dryer'], ['Jorge', 'both']] as [$name, $position]) {
        ServiceStaffModel::create([
            'tenant_id' => $this->tenant->id, 'name' => $name, 'position' => $position,
        ]);
    }

    $names = ($this->as)($this->owner)
        ->getJson('/api/v1/service-staff?position=dryer')
        ->assertOk()
        ->json('data.*.name');

    expect($names)->toEqualCanonicalizing(['Luis', 'Jorge']);
});

test('an owner deactivates a staff member instead of deleting one', function () {
    $staff = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Renunció', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-staff/{$staff->id}", ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    // La fila sigue ahí: los servicios que hizo tienen que poder nombrarla.
    expect(ServiceStaffModel::withoutGlobalScopes()->find($staff->id))->not->toBeNull();
});

test('there is no route to delete a staff member', function () {
    $staff = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-staff/{$staff->id}")
        ->assertStatus(405);
});

test('an invalid position is rejected', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-staff', ['name' => 'Federman', 'position' => 'pulidor'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['position']);
});

test('another tenants staff is invisible', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    ServiceStaffModel::create([
        'tenant_id' => $other->id, 'name' => 'Ajeno', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->getJson('/api/v1/service-staff')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceStaff/ServiceStaffCrudTest.php`
Expected: FAIL — 404 en todas las rutas (`POST /api/v1/service-staff` no existe)

- [ ] **Step 3: Write the resource**

```php
<?php
// apps/backend/app/Infrastructure/Http/Resources/ServiceStaffResource.php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceStaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'position'   => $this->position,
            'is_active'  => (bool) $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 4: Write the controller**

```php
<?php
// apps/backend/app/Infrastructure/Http/Controllers/ServiceStaff/ServiceStaffController.php

namespace App\Infrastructure\Http\Controllers\ServiceStaff;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ServiceStaffResource;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class ServiceStaffController extends Controller
{
    /**
     * Leer el catálogo lo puede hacer cualquier miembro: el select del
     * Registro Diario lo necesita para asignar. Escribirlo es del dueño —
     * el mismo criterio que la configuración del tenant.
     */
    private function mayEdit(Request $request): bool
    {
        if ($request->user()?->is_super_admin) {
            return true;
        }

        $role = TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $request->user()->id)
            ->value('role');

        return in_array($role, ['owner', 'tenant_admin'], true);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => 'FORBIDDEN',
                'message' => 'Solo el administrador puede editar el personal.',
            ],
        ], 403);
    }

    public function index(Request $request): ResourceCollection
    {
        $query = ServiceStaffModel::query();

        // El select de Lavador pide ?position=washer y espera recibir también
        // a los que hacen ambos.
        $position = (string) $request->get('position', '');
        if (in_array($position, [ServiceStaffModel::POSITION_WASHER, ServiceStaffModel::POSITION_DRYER], true)) {
            $query->forPosition($position);
        }

        return ServiceStaffResource::collection(
            $query->orderBy('is_active', 'desc')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->mayEdit($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name'      => 'required|string|max:120',
            'position'  => 'required|in:washer,dryer,both',
            'is_active' => 'sometimes|boolean',
        ]);

        $staff = ServiceStaffModel::create([
            'tenant_id' => app('current_tenant_id'),
            'name'      => $data['name'],
            'position'  => $data['position'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return (new ServiceStaffResource($staff))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $id): ServiceStaffResource|JsonResponse
    {
        if (!$this->mayEdit($request)) {
            return $this->forbidden();
        }

        $staff = ServiceStaffModel::findOrFail($id);

        $data = $request->validate([
            'name'      => 'sometimes|string|max:120',
            'position'  => 'sometimes|in:washer,dryer,both',
            'is_active' => 'sometimes|boolean',
        ]);

        $staff->update($data);

        return new ServiceStaffResource($staff->fresh());
    }
}
```

- [ ] **Step 5: Register the routes**

En `apps/backend/routes/api.php`, inmediatamente antes del comentario
`// Service logs` (alrededor de la línea 197), agregá:

```php
            // Personal que ejecuta el servicio sin ser usuario de la app
            // (lavador / secador). Lectura abierta a miembros porque el
            // select del Registro Diario la necesita; escritura del dueño.
            Route::get('service-staff', [\App\Infrastructure\Http\Controllers\ServiceStaff\ServiceStaffController::class, 'index']);
            Route::post('service-staff', [\App\Infrastructure\Http\Controllers\ServiceStaff\ServiceStaffController::class, 'store']);
            Route::patch('service-staff/{id}', [\App\Infrastructure\Http\Controllers\ServiceStaff\ServiceStaffController::class, 'update']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceStaff/`
Expected: PASS — 11 passed (3 de Task 1 + 8 de este)

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceStaff/ServiceStaffController.php \
        apps/backend/app/Infrastructure/Http/Resources/ServiceStaffResource.php \
        apps/backend/routes/api.php \
        apps/backend/tests/Feature/ServiceStaff/ServiceStaffCrudTest.php
git commit -m "feat(service-staff): CRUD without a delete, because history needs the names"
```

---

### Task 3: Columnas `washed_by` / `dried_by` en `service_logs`

**Files:**
- Create: `apps/backend/database/migrations/2026_08_18_100002_add_assignees_to_service_logs.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php`
- Modify: `apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`store`, `index`, `show`)
- Test: `apps/backend/tests/Feature/ServiceLog/ServiceLogAssigneesTest.php`

**Interfaces:**
- Consumes: `ServiceStaffModel` (Task 1).
- Produces: `ServiceLogModel::washer()` y `ServiceLogModel::dryer()` (`BelongsTo` a `ServiceStaffModel`). El resource expone `washed_by`, `dried_by` y los objetos `washer`/`dryer` con forma `{id, name}` cuando la relación está cargada.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogAssigneesTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 10.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman Paspuel', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis Chalá', 'position' => 'dryer',
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('a service can be registered with no assignees at all', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.washed_by', null)
        ->assertJsonPath('data.dried_by', null);
});

test('a service can be registered with both assignees', function () {
    $response = ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $this->washer->id,
            'dried_by'           => $this->dryer->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(201);

    expect($response->json('data.washed_by'))->toBe($this->washer->id);
    expect($response->json('data.dried_by'))->toBe($this->dryer->id);
});

test('the detail endpoint resolves the assignee names', function () {
    $id = ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $this->washer->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])->json('data.id');

    ($this->as)($this->owner)
        ->getJson("/api/v1/service-logs/{$id}")
        ->assertOk()
        ->assertJsonPath('washer.name', 'Federman Paspuel')
        ->assertJsonPath('dryer', null);
});

test('the list endpoint carries the assignee names for the row', function () {
    ($this->as)($this->owner)->postJson('/api/v1/service-logs', [
        'client_resource_id' => $this->resource->id,
        'attended_by'        => $this->owner->id,
        'washed_by'          => $this->washer->id,
        'dried_by'           => $this->dryer->id,
        'items'              => [[
            'service_id' => $this->service->id, 'label' => 'Lavado',
            'qty' => 1, 'unit_price' => 10.00,
        ]],
        'payment_method' => 'cash',
    ]);

    ($this->as)($this->owner)
        ->getJson('/api/v1/service-logs')
        ->assertOk()
        ->assertJsonPath('data.0.washer.name', 'Federman Paspuel')
        ->assertJsonPath('data.0.dryer.name', 'Luis Chalá');
});

test('staff from another tenant is rejected at registration', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    $alien = ServiceStaffModel::create([
        'tenant_id' => $other->id, 'name' => 'Ajeno', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $alien->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});
```

Nota sobre el envoltorio: `GET /service-logs/{id}` **sí** envuelve en `data`
(este backend no llama `withoutWrapping` en ninguna parte, y el
`ServiceLogTest > can show a service log` pre-existente asserta `data.id`). Los
paths del tercer test van con `data.`. Lo que sí muerde es que
`assertJsonPath(path, null)` pasa cuando el path no existe: cuando la ausencia
es load-bearing, probá además que la clave está.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogAssigneesTest.php`
Expected: FAIL — el primer test falla con `Unable to find JSON path 'data.washed_by'`

- [ ] **Step 3: Write the migration**

```php
<?php
// apps/backend/database/migrations/2026_08_18_100002_add_assignees_to_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Quién lavó y quién secó, apuntando al catálogo service_staff.
     *
     * `attended_by` queda intacta: sigue siendo "quién atendió/registró" y
     * conserva la regla que la pisa con el id del cajero (anti-fraude de
     * comisiones). Separar las columnas es lo que permite tener las dos
     * verdades sin que una destruya a la otra.
     *
     * restrictOnDelete y no nullOnDelete: perder el nombre de quien lavó es
     * exactamente el daño que estas columnas existen para evitar.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->uuid('washed_by')->nullable()->after('attended_by');
            $table->uuid('dried_by')->nullable()->after('washed_by');

            $table->foreign('washed_by')->references('id')->on('service_staff')->restrictOnDelete();
            $table->foreign('dried_by')->references('id')->on('service_staff')->restrictOnDelete();

            $table->index('washed_by');
            $table->index('dried_by');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropForeign(['washed_by']);
            $table->dropForeign(['dried_by']);
            $table->dropIndex(['washed_by']);
            $table->dropIndex(['dried_by']);
            $table->dropColumn(['washed_by', 'dried_by']);
        });
    }
};
```

- [ ] **Step 4: Extend the model**

En `ServiceLogModel.php`, agregá `'washed_by', 'dried_by',` al `$fillable`
justo después de `'attended_by', 'created_by',`, y estas dos relaciones
después del método `attendant()`:

```php
    /** Quién lavó — catálogo service_staff, no un usuario de la app. */
    public function washer()
    {
        return $this->belongsTo(ServiceStaffModel::class, 'washed_by');
    }

    /** Quién secó. */
    public function dryer()
    {
        return $this->belongsTo(ServiceStaffModel::class, 'dried_by');
    }
```

- [ ] **Step 5: Extend the resource**

En `ServiceLogResource.php`, agregá después de la línea `'attended_by' => $this->attended_by,`:

```php
            'washed_by'      => $this->washed_by,
            'dried_by'       => $this->dried_by,
```

y después del bloque `'attendant' => $this->whenLoaded(...)`:

```php
            // Nombres del personal que ejecutó el trabajo. La fila de la
            // lista los muestra y el detalle los usa para el reclamo.
            'washer' => $this->whenLoaded('washer', fn () => $this->washer ? [
                'id'   => $this->washer->id,
                'name' => $this->washer->name,
            ] : null),

            'dryer' => $this->whenLoaded('dryer', fn () => $this->dryer ? [
                'id'   => $this->dryer->id,
                'name' => $this->dryer->name,
            ] : null),
```

- [ ] **Step 6: Accept the fields on create**

En `CreateServiceLogRequest.php`, agregá al array de reglas:

```php
            'washed_by' => 'nullable|uuid|exists:service_staff,id',
            'dried_by'  => 'nullable|uuid|exists:service_staff,id',
```

`exists` sin scope de tenant no alcanza — un id de otro tenant existe. Agregá
en el mismo request, después de `rules()`, la validación cruzada:

```php
    /**
     * `exists:service_staff,id` deja pasar personal de otro tenant. El
     * scope no se puede expresar en la regla porque el tenant vive en el
     * contenedor, no en el request.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            foreach (['washed_by', 'dried_by'] as $field) {
                $id = $this->input($field);
                if (!$id) {
                    continue;
                }

                $belongs = \App\Infrastructure\Persistence\Models\ServiceStaffModel::query()
                    ->where('id', $id)
                    ->exists();

                if (!$belongs) {
                    $validator->errors()->add($field, 'El personal seleccionado no pertenece a este negocio.');
                }
            }
        });
    }
```

El `ServiceStaffModel::query()` ya viene filtrado por `TenantScope`, así que
`exists()` es la verificación de pertenencia.

- [ ] **Step 7: Persist on store and eager-load on read**

En `ServiceLogController::store()`, dentro del array `$patch` (justo después
del bloque `if ($request->service_variant_id) {...}`), agregá:

```php
        // Asignados al registrar: opcionales. Van por el modelo y no por el
        // DTO para no arrastrar el pipeline de dominio por dos columnas.
        foreach (['washed_by', 'dried_by'] as $field) {
            if ($request->filled($field)) {
                $patch[$field] = $request->input($field);
            }
        }
```

En `index()`, cambiá el `with(...)` para incluir las dos relaciones:

```php
        $query = ServiceLogModel::with([
            'clientResource.client', 'service', 'attendant', 'items.variant',
            'washer', 'dryer',
        ]);
```

En `show()`, igual:

```php
        $serviceLog = ServiceLogModel::with([
            'clientResource.client', 'service', 'attendant', 'reservation', 'items.variant',
            'washer', 'dryer',
        ])->findOrFail($id);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogAssigneesTest.php`
Expected: PASS — 5 passed

- [ ] **Step 9: Verify the pin survived**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/CashierAttributionTest.php`
Expected: PASS — 5 passed, sin haber editado el archivo

- [ ] **Step 10: Commit**

```bash
git add apps/backend/database/migrations/2026_08_18_100002_add_assignees_to_service_logs.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php \
        apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php \
        apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php \
        apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogAssigneesTest.php
git commit -m "feat(registro-diario): record who washed and who dried"
```

---

### Task 4: Tabla, modelo y escritor de la bitácora

**Files:**
- Create: `apps/backend/database/migrations/2026_08_18_100003_create_service_log_events_table.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php`
- Create: `apps/backend/app/Application/Services/ServiceLogEventRecorder.php`
- Test: `apps/backend/tests/Feature/ServiceLog/ServiceLogEventRecorderTest.php`

**Interfaces:**
- Consumes: `ServiceLogModel` (Task 3), `ServiceStaffModel` (Task 1).
- Produces: `ServiceLogEventRecorder` con estos siete métodos públicos, todos `void`:

```php
created(ServiceLogModel $log, ?string $actorId)
assigneeChanged(ServiceLogModel $log, string $position, ?ServiceStaffModel $from, ?ServiceStaffModel $to, ?string $actorId)
itemsChanged(ServiceLogModel $log, float $totalBefore, float $totalAfter, ?string $actorId)
paymentRecorded(ServiceLogModel $log, string $method, ?string $bank, float $amount, ?string $actorId)
statusChanged(ServiceLogModel $log, string $from, string $to, ?string $actorId)
invoiceRequested(ServiceLogModel $log, ?string $actorId)
invoiceStatusChanged(ServiceLogModel $log, ?string $from, string $to, ?string $reason = null)
```

y las constantes `ServiceLogEventModel::EVENT_CREATED`, `EVENT_ASSIGNEE_CHANGED`, `EVENT_ITEMS_CHANGED`, `EVENT_PAYMENT_RECORDED`, `EVENT_STATUS_CHANGED`, `EVENT_INVOICE_REQUESTED`, `EVENT_INVOICE_STATUS_CHANGED`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogEventRecorderTest.php

use App\Application\Services\ServiceLogEventRecorder;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);
    $this->log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
    ]);

    $this->recorder = app(ServiceLogEventRecorder::class);
});

test('created writes one event stamped with the tenant and the actor', function () {
    $this->recorder->created($this->log, $this->user->id);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_CREATED);
    expect($event->service_log_id)->toBe($this->log->id);
    expect($event->tenant_id)->toBe($this->tenant->id);
    expect($event->changed_by_user_id)->toBe($this->user->id);
    expect($event->changed_at)->not->toBeNull();
});

test('assigneeChanged denormalizes both names so a rename cannot rewrite history', function () {
    $from = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Jorge Tián', 'position' => 'washer',
    ]);
    $to = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman Paspuel', 'position' => 'washer',
    ]);

    $this->recorder->assigneeChanged($this->log, 'washer', $from, $to, $this->user->id);

    // El catálogo se renombra después del hecho.
    $to->update(['name' => 'OTRO NOMBRE']);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED);
    expect($event->detail['position'])->toBe('washer');
    expect($event->detail['from_name'])->toBe('Jorge Tián');
    expect($event->detail['to_name'])->toBe('Federman Paspuel');
    expect($event->detail['from_id'])->toBe($from->id);
    expect($event->detail['to_id'])->toBe($to->id);
});

test('assigneeChanged handles an assignment from nobody', function () {
    $to = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);

    $this->recorder->assigneeChanged($this->log, 'dryer', null, $to, $this->user->id);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->detail['from_id'])->toBeNull();
    expect($event->detail['from_name'])->toBeNull();
    expect($event->detail['to_name'])->toBe('Federman');
});

test('paymentRecorded keeps the method, the bank and the amount', function () {
    $this->recorder->paymentRecorded($this->log, 'transfer', 'pichincha', 12.50, $this->user->id);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_PAYMENT_RECORDED);
    expect($event->detail)->toBe(['method' => 'transfer', 'bank' => 'pichincha', 'amount' => 12.5]);
});

test('itemsChanged keeps both totals', function () {
    $this->recorder->itemsChanged($this->log, 12.00, 18.00, $this->user->id);

    expect(ServiceLogEventModel::withoutGlobalScopes()->first()->detail)
        ->toBe(['total_before' => 12.0, 'total_after' => 18.0]);
});

test('statusChanged keeps the transition', function () {
    $this->recorder->statusChanged($this->log, 'in_progress', 'completed', $this->user->id);

    expect(ServiceLogEventModel::withoutGlobalScopes()->first()->detail)
        ->toBe(['from' => 'in_progress', 'to' => 'completed']);
});

test('invoiceStatusChanged has no actor because the SRI is not a person', function () {
    $this->recorder->invoiceStatusChanged($this->log, 'enviada', 'rechazada', 'ESTABLECIMIENTO CERRADO');

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_INVOICE_STATUS_CHANGED);
    expect($event->changed_by_user_id)->toBeNull();
    expect($event->detail['to'])->toBe('rechazada');
    expect($event->detail['reason'])->toBe('ESTABLECIMIENTO CERRADO');
});

test('the log is append-only: the model carries no updated_at', function () {
    $this->recorder->created($this->log, $this->user->id);

    expect(ServiceLogEventModel::withoutGlobalScopes()->first()->timestamps)->toBeFalse();
    expect(ServiceLogEventModel::UPDATED_AT)->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogEventRecorderTest.php`
Expected: FAIL — `Class "App\Application\Services\ServiceLogEventRecorder" not found`

- [ ] **Step 3: Write the migration**

Sigue las convenciones de `reservation_item_changes`, que es el log de
auditoría que ya existe en este repo: `changed_at` con `useCurrent()`, doble
índice, y la FK del actor con `nullOnDelete`.

```php
<?php
// apps/backend/database/migrations/2026_08_18_100003_create_service_log_events_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bitácora append-only del servicio: registro, asignación de lavador y
     * secador, edición de items, cobro, completado y facturación. Existe
     * para defender un reclamo del dueño del vehículo semanas después —
     * incluido el caso en que alguien corrija un dato justo después de que
     * el reclamo entró.
     *
     * `detail` es json porque cada evento carga una forma distinta y ninguna
     * consulta filtra por su contenido: se lee siempre por service_log_id en
     * orden cronológico.
     *
     * Mismas convenciones que reservation_item_changes.
     */
    public function up(): void
    {
        Schema::create('service_log_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('service_log_id');
            $table->string('event', 40);
            $table->json('detail')->nullable();
            // Null = lo hizo el sistema (el veredicto del SRI, vía job).
            $table->uuid('changed_by_user_id')->nullable();
            $table->timestamp('changed_at')->useCurrent();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('service_log_id')->references('id')->on('service_logs')->cascadeOnDelete();
            $table->foreign('changed_by_user_id')->references('id')->on('users')->nullOnDelete();

            $table->index(['service_log_id', 'changed_at']);
            $table->index(['tenant_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_log_events');
    }
};
```

- [ ] **Step 4: Write the model**

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una fila de la bitácora. Append-only: no hay update ni delete, y por eso
 * no hay updated_at.
 */
class ServiceLogEventModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'service_log_events';

    public const UPDATED_AT = null;
    public $timestamps = false;

    public const EVENT_CREATED                = 'created';
    public const EVENT_ASSIGNEE_CHANGED       = 'assignee_changed';
    public const EVENT_ITEMS_CHANGED          = 'items_changed';
    public const EVENT_PAYMENT_RECORDED       = 'payment_recorded';
    public const EVENT_STATUS_CHANGED         = 'status_changed';
    public const EVENT_INVOICE_REQUESTED      = 'invoice_requested';
    public const EVENT_INVOICE_STATUS_CHANGED = 'invoice_status_changed';

    protected $fillable = [
        'tenant_id', 'service_log_id', 'event', 'detail',
        'changed_by_user_id', 'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'detail'     => 'array',
            'changed_at' => 'datetime',
        ];
    }

    public function serviceLog(): BelongsTo
    {
        return $this->belongsTo(ServiceLogModel::class, 'service_log_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'changed_by_user_id');
    }
}
```

- [ ] **Step 5: Write the recorder**

```php
<?php
// apps/backend/app/Application/Services/ServiceLogEventRecorder.php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;

/**
 * Escritor único de la bitácora del servicio.
 *
 * Un método por evento en vez de un record(string $event, array $detail)
 * genérico: el tipo de cada firma es lo que impide que dos de los siete
 * llamadores escriban el mismo evento con formas distintas de `detail`, que
 * es la falla que vuelve inservible una bitácora seis meses después, justo
 * cuando hace falta.
 */
class ServiceLogEventRecorder
{
    public function created(ServiceLogModel $log, ?string $actorId): void
    {
        $this->write($log, ServiceLogEventModel::EVENT_CREATED, [], $actorId);
    }

    /**
     * Los nombres van desnormalizados: si el catálogo se renombra, la
     * bitácora tiene que seguir diciendo lo que decía el día del servicio.
     */
    public function assigneeChanged(
        ServiceLogModel $log,
        string $position,
        ?ServiceStaffModel $from,
        ?ServiceStaffModel $to,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED, [
            'position'  => $position,
            'from_id'   => $from?->id,
            'from_name' => $from?->name,
            'to_id'     => $to?->id,
            'to_name'   => $to?->name,
        ], $actorId);
    }

    public function itemsChanged(
        ServiceLogModel $log,
        float $totalBefore,
        float $totalAfter,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_ITEMS_CHANGED, [
            'total_before' => $totalBefore,
            'total_after'  => $totalAfter,
        ], $actorId);
    }

    public function paymentRecorded(
        ServiceLogModel $log,
        string $method,
        ?string $bank,
        float $amount,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_PAYMENT_RECORDED, [
            'method' => $method,
            'bank'   => $bank,
            'amount' => $amount,
        ], $actorId);
    }

    public function statusChanged(
        ServiceLogModel $log,
        string $from,
        string $to,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_STATUS_CHANGED, [
            'from' => $from,
            'to'   => $to,
        ], $actorId);
    }

    public function invoiceRequested(ServiceLogModel $log, ?string $actorId): void
    {
        $this->write($log, ServiceLogEventModel::EVENT_INVOICE_REQUESTED, [], $actorId);
    }

    /**
     * Sin actor: el veredicto lo emite el SRI y llega por un job, no por una
     * persona. La UI lo muestra como "SRI".
     */
    public function invoiceStatusChanged(
        ServiceLogModel $log,
        ?string $from,
        string $to,
        ?string $reason = null,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_INVOICE_STATUS_CHANGED, [
            'from'   => $from,
            'to'     => $to,
            'reason' => $reason,
        ], null);
    }

    /**
     * tenant_id sale del log y no del contenedor: los jobs corren sin
     * current_tenant_id bindeado, y TenantScope no rellena en el insert.
     */
    private function write(ServiceLogModel $log, string $event, array $detail, ?string $actorId): void
    {
        ServiceLogEventModel::create([
            'tenant_id'          => $log->tenant_id,
            'service_log_id'     => $log->id,
            'event'              => $event,
            'detail'             => $detail,
            'changed_by_user_id' => $actorId,
            'changed_at'         => now(),
        ]);
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogEventRecorderTest.php`
Expected: PASS — 8 passed

- [ ] **Step 7: Commit**

```bash
git add apps/backend/database/migrations/2026_08_18_100003_create_service_log_events_table.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php \
        apps/backend/app/Application/Services/ServiceLogEventRecorder.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogEventRecorderTest.php
git commit -m "feat(bitacora): an append-only trail with one typed writer per event"
```

---

### Task 5: Enchufar el recorder en los flujos que ya existen

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`__construct`, `store`, `updateItems`, `recordPayment`, `complete`, `invoice`)
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/SyncServiceLogInvoiceStatusJob.php`
- Test: `apps/backend/tests/Feature/ServiceLog/ServiceLogEventWiringTest.php`

**Interfaces:**
- Consumes: `ServiceLogEventRecorder` (Task 4), inyectado por el contenedor.
- Produces: nada nuevo. A partir de acá cada mutación del registro deja su fila.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogEventWiringTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 10.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->events = fn (string $logId) => ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $logId)
        ->orderBy('changed_at')
        ->pluck('event')
        ->all();

    $this->register = fn (array $extra = []) => ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('registering a service writes a created event', function () {
    $id = ($this->register)()->json('data.id');

    expect(($this->events)($id))->toBe([ServiceLogEventModel::EVENT_CREATED]);

    $event = ServiceLogEventModel::withoutGlobalScopes()->where('service_log_id', $id)->first();
    expect($event->changed_by_user_id)->toBe($this->owner->id);
});

test('editing the items writes both totals', function () {
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 2, 'unit_price' => 10.00,
            ]],
        ])
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_ITEMS_CHANGED)
        ->first();

    // toEqual y no toBe: un 10.0 vuelve de JSON como int 10, y a la bitácora no
    // le importa el tipo de PHP.
    expect($event->detail)->toEqual(['total_before' => 10, 'total_after' => 20]);
});

test('recording a payment writes the method and the bank', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    ($this->as)($this->owner)
        ->postJson("/api/v1/service-logs/{$id}/payment", [
            'method' => 'transfer', 'bank' => 'pichincha',
        ])
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_PAYMENT_RECORDED)
        ->first();

    expect($event->detail['method'])->toBe('transfer');
    expect($event->detail['bank'])->toBe('pichincha');
    expect($event->detail['amount'])->toEqual(10);
});

test('completing writes the transition', function () {
    $id = ($this->register)([
        'washed_by' => $this->washer->id,
        'dried_by'  => $this->dryer->id,
    ])->json('data.id');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$id}/complete")
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_STATUS_CHANGED)
        ->first();

    expect($event->detail)->toBe(['from' => 'in_progress', 'to' => 'completed']);
});

test('a failed complete writes no event', function () {
    // Sin asignados el complete devuelve 422 (Task 7); la bitácora no debe
    // registrar una transición que no ocurrió.
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)->patchJson("/api/v1/service-logs/{$id}/complete");

    expect(($this->events)($id))->not->toContain(ServiceLogEventModel::EVENT_STATUS_CHANGED);
});

test('requesting an invoice writes the request', function () {
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)->postJson("/api/v1/service-logs/{$id}/invoice");

    expect(($this->events)($id))->toContain(ServiceLogEventModel::EVENT_INVOICE_REQUESTED);
});

test('deleting a log takes its trail with it', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'invoice_status' => null,
    ]);
    app(\App\Application\Services\ServiceLogEventRecorder::class)->created($log, $this->owner->id);

    ($this->as)($this->owner)->deleteJson("/api/v1/service-logs/{$log->id}")->assertOk();

    expect(ServiceLogEventModel::withoutGlobalScopes()->where('service_log_id', $log->id)->count())
        ->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogEventWiringTest.php`
Expected: FAIL — el primer test falla porque `events` devuelve `[]`

- [ ] **Step 3: Inject the recorder into the controller**

En `ServiceLogController::__construct`, agregá el parámetro:

```php
    public function __construct(
        private CreateServiceLogUseCase $createServiceLog,
        private GetDailyLogUseCase $getDailyLog,
        private ServiceLogRepositoryInterface $serviceLogRepository,
        private ConsumptionEngine $consumption,
        private StockLedger $stock,
        private ServiceLogEventRecorder $events,
    ) {}
```

y el import `use App\Application\Services\ServiceLogEventRecorder;` junto a los
demás `use App\Application\...`.

- [ ] **Step 4: Record on store**

En `store()`, justo antes del `$model = ServiceLogModel::with([...])->find($serviceLog->id);`
del final, agregá:

```php
        // La bitácora arranca acá: el resto de los eventos se cuelgan de este.
        $logModel = ServiceLogModel::findOrFail($serviceLog->id);
        $this->events->created($logModel, $request->user()?->id);
```

- [ ] **Step 5: Record on updateItems**

En `updateItems()`, el total anterior hay que capturarlo **antes** de la
transacción, porque adentro se reescribe. Agregá antes del
`\Illuminate\Support\Facades\DB::transaction(...)`:

```php
        $totalBefore = (float) $serviceLog->price_charged;
```

y dentro del closure de la transacción, al final (después del
`$serviceLog->update([...])`), agregá:

```php
            // Dentro de la transacción: un evento sin su cambio miente.
            $this->events->itemsChanged($serviceLog, $totalBefore, $newTotal, $userId);
```

Acordate de agregar `$totalBefore` a la lista de variables capturadas del
closure: `function () use ($serviceLog, $items, $userId, $totalBefore) {`.

- [ ] **Step 6: Record on recordPayment**

En `recordPayment()`, después del `$log->update([...])` y antes del `return`:

```php
        $this->events->paymentRecorded(
            $log,
            $data['method'],
            $data['method'] === 'transfer' ? ($data['bank'] ?? null) : null,
            (float) $log->price_charged,
            $request->user()?->id,
        );
```

- [ ] **Step 7: Record on complete**

`complete()` hoy no recibe el `Request`. Cambiá la firma a
`public function complete(Request $request, string $id): JsonResponse` — la
ruta ya pasa el request como primer argumento cuando el método lo declara, así
que no hay que tocar `routes/api.php`. Después del bloque de consumo:

```php
        if ($log) {
            $this->consumption->applyForServiceLog($log);
            $this->events->statusChanged($log, 'in_progress', 'completed', $request->user()?->id);
        }
```

- [ ] **Step 8: Record on invoice**

`invoice()` tampoco recibe el `Request`. Cambiá la firma a
`public function invoice(Request $request, string $id): JsonResponse` y, justo
antes del `EmitServiceLogInvoiceJob::dispatch($id);`:

```php
        $this->events->invoiceRequested($log, $request->user()?->id);
```

- [ ] **Step 9: Record the SRI verdicts in the jobs**

En `EmitServiceLogInvoiceJob` y `SyncServiceLogInvoiceStatusJob` hay cinco
lugares que escriben `invoice_status` (líneas aproximadas 51, 88 y 126 del
primero; 65 y 96 del segundo). En cada uno:

1. Capturá el estado previo **antes** del update:
   ```php
   $previousStatus = $log->invoice_status;
   ```
2. Después del update, escribí el evento:
   ```php
   app(\App\Application\Services\ServiceLogEventRecorder::class)
       ->invoiceStatusChanged($log, $previousStatus, 'rechazada', $log->invoice_error);
   ```
   con el `to` que corresponda a ese punto (`'rechazada'`, `'autorizada'`, o
   `$result['estado'] ?? 'enviada'`) y `reason` solo cuando haya un motivo
   (para `autorizada` pasá `null`).

Se resuelve por `app()` y no por constructor porque los jobs se serializan a
la cola y una dependencia inyectada tendría que serializarse con ellos.

- [ ] **Step 10: Run tests**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/`
Expected: PASS en todo salvo el fallo pre-existente
`create service log requires required fields`, más los tests de Task 7 que
todavía no existen. El test `a failed complete writes no event` va a pasar de
casualidad hasta Task 7 (hoy el complete no falla); queda como red de
seguridad para cuando el 422 exista.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php \
        apps/backend/app/Infrastructure/Jobs/SyncServiceLogInvoiceStatusJob.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogEventWiringTest.php
git commit -m "feat(bitacora): wire the trail into every mutation of a service log"
```

---

### Task 6: Endpoint de asignación con sus dos gates

**Files:**
- Modify: `apps/backend/app/Domain/Tenant/StaffPrivileges.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php`
- Modify: `apps/backend/routes/api.php`
- Test: `apps/backend/tests/Feature/ServiceLog/ServiceLogAssignGateTest.php`

**Interfaces:**
- Consumes: `ServiceLogEventRecorder::assigneeChanged` (Task 4), `StaffPrivileges::granted` (ya existe), `ServiceStaffModel::forPosition` (Task 1).
- Produces: `PATCH /api/v1/service-logs/{id}/assignees` con body `{washed_by?: uuid|null, dried_by?: uuid|null}`, y la constante `StaffPrivileges::ASSIGNEES = 'Asignados'`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogAssignGateTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner   = ($this->member)('owner');
    $this->admin   = ($this->member)('tenant_admin');
    $this->cashier = ($this->member)('cashier');
    $this->washerUser = ($this->member)('washer');

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->log = fn (string $status = 'in_progress') => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->cashier->id,
        'created_by' => $this->cashier->id,
        'status' => $status,
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->grant = function (string $matrixRole, string $privilege) {
        $settings = $this->tenant->settings ?? [];
        $permissions = $settings['permissions'] ?? [];
        $permissions[$matrixRole][$privilege] = 'full';
        $settings['permissions'] = $permissions;
        $this->tenant->update(['settings' => $settings]);
    };
});

test('a cashier assigns while the service is in progress', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBe($this->washer->id);
});

test('a cashier cannot touch the assignees once completed', function () {
    $log = ($this->log)('completed');

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'ASSIGNEES_LOCKED');

    expect($log->fresh()->washed_by)->toBeNull();
});

test('an admin corrects the assignees after completion', function () {
    $log = ($this->log)('completed');

    ($this->as)($this->admin)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBe($this->washer->id);
});

test('an owner corrects the assignees after completion', function () {
    $log = ($this->log)('completed');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'dried_by' => $this->dryer->id,
        ])
        ->assertOk();
});

test('a washer cannot assign with the default matrix', function () {
    $log = ($this->log)();

    ($this->as)($this->washerUser)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'ASSIGNEES_FORBIDDEN');
});

test('a washer granted Asignados can assign while in progress', function () {
    ($this->grant)('Lavador', 'Asignados');
    $log = ($this->log)();

    ($this->as)($this->washerUser)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();
});

test('a washer granted Asignados is still locked out after completion', function () {
    // El bloqueo post-completado es regla fija, no una casilla de la matriz.
    ($this->grant)('Lavador', 'Asignados');
    $log = ($this->log)('completed');

    ($this->as)($this->washerUser)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'ASSIGNEES_LOCKED');
});

test('each changed position writes one event, and an unchanged one writes none', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
            'dried_by'  => $this->dryer->id,
        ])
        ->assertOk();

    expect(ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED)
        ->count())->toBe(2);

    // Reenviar lo mismo no mueve nada, así que no escribe nada.
    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
            'dried_by'  => $this->dryer->id,
        ])
        ->assertOk();

    expect(ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED)
        ->count())->toBe(2);
});

test('clearing an assignee is a change and is recorded', function () {
    $log = ($this->log)();
    $log->update(['washed_by' => $this->washer->id]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", ['washed_by' => null])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBeNull();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)->latest('changed_at')->first();

    expect($event->detail['from_name'])->toBe('Federman');
    expect($event->detail['to_name'])->toBeNull();
});

test('a dryer cannot be assigned as the washer', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->dryer->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});

test('an inactive staff member cannot be assigned', function () {
    $log = ($this->log)();
    $this->washer->update(['is_active' => false]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogAssignGateTest.php`
Expected: FAIL — 404, la ruta no existe

- [ ] **Step 3: Add the privilege**

En `apps/backend/app/Domain/Tenant/StaffPrivileges.php`:

- agregá la constante junto a las otras dos:
  ```php
      public const ASSIGNEES = 'Asignados';
  ```
- agregá la clave a cada fila de `DEFAULTS`. Admin y Cajero la tienen, Lavador
  y Cliente no:
  ```php
      private const DEFAULTS = [
          'Admin'   => [self::PRICE => 'full', self::DELETE => 'full', self::ASSIGNEES => 'full'],
          'Cajero'  => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'full'],
          'Lavador' => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'none'],
          'Cliente' => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'none'],
      ];
  ```
- actualizá el docblock de la clase para nombrar el tercer privilegio.

- [ ] **Step 4: Write the endpoint**

En `ServiceLogController`, agregá el método (por ejemplo después de `updateItems`):

```php
    /**
     * Asigna o corrige lavador y secador. Dos gates, y el estado del
     * registro decide cuál aplica:
     *
     * - en progreso → privilegio `Asignados` de la matriz (default: Admin y
     *   Cajero). Es la acción del día: el cajero asigna al lavador cuando
     *   arranca y al secador cuando seca.
     * - completado → owner/tenant_admin, regla fija y no configurable. Si
     *   fuera una casilla, alguien podría devolvérsela al cajero y el rastro
     *   pierde el sentido que lo justifica: el reclamo del dueño del
     *   vehículo llega al mostrador, y quien lo atiende no puede ser quien
     *   reescribe el historial.
     */
    public function updateAssignees(Request $request, string $id): ServiceLogResource|JsonResponse
    {
        $log = ServiceLogModel::findOrFail($id);

        if ($log->status === 'completed') {
            $isManager = $request->user()?->is_super_admin
                || in_array($this->tenantRole($request), ['owner', 'tenant_admin'], true);

            if (!$isManager) {
                return response()->json([
                    'error' => [
                        'code'    => 'ASSIGNEES_LOCKED',
                        'message' => 'El servicio ya está completado: solo el administrador puede corregir los asignados.',
                    ],
                ], 403);
            }
        } elseif (!$this->may($request, StaffPrivileges::ASSIGNEES)) {
            return response()->json([
                'error' => [
                    'code'    => 'ASSIGNEES_FORBIDDEN',
                    'message' => 'Tu rol no tiene permiso para asignar personal.',
                ],
            ], 403);
        }

        $request->validate([
            'washed_by' => 'nullable|uuid',
            'dried_by'  => 'nullable|uuid',
        ]);

        // Solo los puestos que el request menciona. Omitir un campo es "no lo
        // toques"; mandarlo en null es "sacá al asignado", y son cosas
        // distintas.
        $positions = [
            'washed_by' => ServiceStaffModel::POSITION_WASHER,
            'dried_by'  => ServiceStaffModel::POSITION_DRYER,
        ];

        $resolved = [];
        foreach ($positions as $field => $position) {
            if (!$request->has($field)) {
                continue;
            }

            $staffId = $request->input($field);
            if ($staffId === null) {
                $resolved[$field] = null;
                continue;
            }

            // forPosition ya filtra activos y acepta 'both'; el TenantScope
            // se encarga de la pertenencia.
            $staff = ServiceStaffModel::forPosition($position)->find($staffId);
            if (!$staff) {
                return response()->json([
                    'message' => 'El personal seleccionado no es válido para ese puesto.',
                    'errors'  => [$field => ['El personal seleccionado no es válido para ese puesto.']],
                ], 422);
            }

            $resolved[$field] = $staff;
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($log, $resolved, $positions, $request) {
            $patch = [];

            foreach ($resolved as $field => $staff) {
                $currentId = $log->{$field};
                $nextId    = $staff?->id;

                if ($currentId === $nextId) {
                    continue;
                }

                $patch[$field] = $nextId;

                $this->events->assigneeChanged(
                    $log,
                    $positions[$field],
                    $currentId ? ServiceStaffModel::withoutGlobalScopes()->find($currentId) : null,
                    $staff,
                    $request->user()?->id,
                );
            }

            if ($patch !== []) {
                $log->update($patch);
            }
        });

        return new ServiceLogResource(
            $log->fresh()->load(['clientResource.client', 'service', 'attendant', 'washer', 'dryer'])
        );
    }
```

Agregá el import `use App\Infrastructure\Persistence\Models\ServiceStaffModel;`
junto a los demás modelos.

- [ ] **Step 5: Register the route**

En `routes/api.php`, después de `Route::put('service-logs/{id}/items', ...)`:

```php
            // Asignar lavador y secador. Gate doble: privilegio en progreso,
            // solo admin una vez completado.
            Route::patch('service-logs/{id}/assignees', [ServiceLogController::class, 'updateAssignees']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogAssignGateTest.php`
Expected: PASS — 11 passed

- [ ] **Step 7: Verify the other privileges still behave**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogPermissionsTest.php`
Expected: PASS — 18 passed

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Domain/Tenant/StaffPrivileges.php \
        apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/routes/api.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogAssignGateTest.php
git commit -m "feat(asignados): assign while in progress, admin-only once completed"
```

---

### Task 7: Completar exige los dos asignados

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`complete`)
- Test: `apps/backend/tests/Feature/ServiceLog/ServiceLogCompleteGateTest.php`

**Interfaces:**
- Consumes: `washed_by`/`dried_by` (Task 3), `TenantModel::business_type`.
- Produces: `PATCH /service-logs/{id}/complete` devuelve 422 con `error.code = 'ASSIGNEES_REQUIRED'` cuando falta alguno y el tenant es `car_wash`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogCompleteGateTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function completeGateSetup(string $businessType): array
{
    $tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => $businessType,
    ]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
        'user_id' => $owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenant->id, 'client_id' => $owner->id, 'type' => 'sedan',
    ]);

    return [$tenant, $owner, $service, $resource];
}

beforeEach(function () {
    [$this->tenant, $this->owner, $this->service, $this->resource] = completeGateSetup('car_wash');

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->log = fn (array $attrs = []) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'status' => 'in_progress',
    ], $attrs));

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('completing without a washer is rejected', function () {
    $log = ($this->log)(['dried_by' => $this->dryer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');

    expect($log->fresh()->status)->toBe('in_progress');
});

test('completing without a dryer is rejected', function () {
    $log = ($this->log)(['washed_by' => $this->washer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');
});

test('completing with both assignees works', function () {
    $log = ($this->log)([
        'washed_by' => $this->washer->id,
        'dried_by'  => $this->dryer->id,
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});

test('a barbershop completes with no assignees at all', function () {
    // El gate es solo de car_wash: en los demás rubros estas columnas no se
    // usan y el endpoint tiene que comportarse igual que siempre.
    [$tenant, $owner, $service, $resource] = completeGateSetup('barbershop');

    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $owner->id,
        'created_by' => $owner->id,
        'status' => 'in_progress',
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogCompleteGateTest.php`
Expected: FAIL — los dos primeros devuelven 200 en vez de 422

- [ ] **Step 3: Add the gate**

En `ServiceLogController::complete()`, al principio del método (antes del
`$this->serviceLogRepository->complete(...)`):

```php
        $log = ServiceLogModel::findOrFail($id);

        // Completar es el momento en que el dato se congela, así que es el
        // momento de exigirlo: un servicio cerrado sin lavador ni secador es
        // exactamente el agujero que esta feature existe para tapar.
        $isCarWash = TenantModel::find(app('current_tenant_id'))?->business_type === 'car_wash';

        if ($isCarWash && (!$log->washed_by || !$log->dried_by)) {
            return response()->json([
                'error' => [
                    'code'    => 'ASSIGNEES_REQUIRED',
                    'message' => 'Asigná lavador y secador antes de completar el servicio.',
                ],
            ], 422);
        }
```

El método ya recarga el log más abajo (`$log = ServiceLogModel::find($id);`);
renombrá esa segunda asignación o reutilizá la variable, pero no dejes dos
`findOrFail` seguidos.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogCompleteGateTest.php`
Expected: PASS — 4 passed

- [ ] **Step 5: Run the whole service-log suite**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/`
Expected: solo el fallo pre-existente `create service log requires required fields`.
Si `ServiceLogTest` u otro suite rompe por completar sin asignados, es porque
su tenant es `car_wash`: revisá el `business_type` que usa su factory. La
factory de tenants **no** debería crear `car_wash` por defecto; si lo hace,
esos tests necesitan asignados o un `business_type` explícito.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogCompleteGateTest.php
git commit -m "feat(registro-diario): a car wash cannot complete a service with nobody on it"
```

---

### Task 8: El detalle devuelve la bitácora

**Files:**
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`show`)
- Test: `apps/backend/tests/Feature/ServiceLog/ServiceLogEventsApiTest.php`

**Interfaces:**
- Consumes: `ServiceLogEventModel` (Task 4).
- Produces: `GET /service-logs/{id}` incluye `events: [{id, event, detail, changed_at, changed_by: {id, name} | null}]` en orden cronológico ascendente. El índice **no** los incluye.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogEventsApiTest.php

use App\Application\Services\ServiceLogEventRecorder;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create(['name' => 'Danny Barahona']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
    ]);
});

test('the detail returns the trail oldest first, with the actor name', function () {
    $recorder = app(ServiceLogEventRecorder::class);
    $recorder->created($this->log, $this->owner->id);
    $recorder->paymentRecorded($this->log, 'cash', null, 12.00, $this->owner->id);
    $recorder->invoiceStatusChanged($this->log, 'enviada', 'autorizada');

    $response = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs/{$this->log->id}")
        ->assertOk();

    // El recurso SÍ envuelve en `data` (no hay withoutWrapping en este
    // backend; el ServiceLogTest pre-existente asserta `data.id`).
    expect($response->json('data.events.*.event'))->toBe([
        'created', 'payment_recorded', 'invoice_status_changed',
    ]);
    expect($response->json('data.events.0.changed_by.name'))->toBe('Danny Barahona');

    // La clave tiene que existir y ser null — un path ausente también
    // devuelve null y la aserción pasaría sin probar nada.
    $events = $response->json('data.events');
    expect($events[2])->toHaveKey('changed_by');
    expect($events[2]['changed_by'])->toBeNull();
    expect($response->json('data.events.1.detail.amount'))->toBe(12);
});

test('the list endpoint does not carry the trail', function () {
    app(ServiceLogEventRecorder::class)->created($this->log, $this->owner->id);

    $row = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/service-logs')
        ->assertOk()
        ->json('data.0');

    expect($row)->not->toHaveKey('events');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogEventsApiTest.php`
Expected: FAIL — `events.*.event` viene vacío

- [ ] **Step 3: Add the relation**

En `ServiceLogModel`, después de `items()`:

```php
    /** Bitácora del servicio, del más viejo al más nuevo: se lee como relato. */
    public function events()
    {
        return $this->hasMany(ServiceLogEventModel::class, 'service_log_id')
            ->orderBy('changed_at');
    }
```

- [ ] **Step 4: Expose it in the resource**

En `ServiceLogResource::toArray`, después del bloque `services_summary`:

```php
            // Bitácora. Solo cuando el llamador la pidió: son N filas por
            // registro y la lista del día no la usa.
            'events' => $this->whenLoaded('events', fn () => $this->events->map(fn ($e) => [
                'id'         => $e->id,
                'event'      => $e->event,
                'detail'     => $e->detail ?? [],
                'changed_at' => $e->changed_at?->toIso8601String(),
                'changed_by' => $e->relationLoaded('changedBy') && $e->changedBy
                    ? ['id' => $e->changedBy->id, 'name' => $e->changedBy->name]
                    : null,
            ])),
```

- [ ] **Step 5: Eager-load it on show**

En `show()`:

```php
        $serviceLog = ServiceLogModel::with([
            'clientResource.client', 'service', 'attendant', 'reservation', 'items.variant',
            'washer', 'dryer', 'events.changedBy',
        ])->findOrFail($id);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ServiceLogEventsApiTest.php`
Expected: PASS — 2 passed

- [ ] **Step 7: Run the full backend suite**

Run: `cd apps/backend && ./vendor/bin/pest`
Expected: los mismos **9 fallos pre-existentes** y nada más. Si aparece un
décimo, es tuyo.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php \
        apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php \
        apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogEventsApiTest.php
git commit -m "feat(bitacora): serve the trail from the service detail endpoint"
```

---

### Task 9: Stack de `service-staff` en el admin

**Files:**
- Create: `apps/admin-v2/src/domain/entities/service-staff.ts`
- Create: `apps/admin-v2/src/domain/repositories/service-staff.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-service-staff.repository.ts`
- Create: `apps/admin-v2/src/application/use-cases/service-staff/list-service-staff.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/service-staff/create-service-staff.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/service-staff/update-service-staff.use-case.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-service-staff.ts`
- Modify: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`

**Interfaces:**
- Consumes: los endpoints de Task 2.
- Produces: `useServiceStaff(position?: StaffPosition)`, `useCreateServiceStaff()`, `useUpdateServiceStaff()`. Tipos `ServiceStaff { id, name, position, isActive, createdAt }`, `StaffPosition = 'washer' | 'dryer' | 'both'`.

Sigue exactamente el patrón de `business-resource` (entity → repository
interface → api repository con su mapper local → use case por operación → hook).

- [ ] **Step 1: Write the entity**

```ts
// apps/admin-v2/src/domain/entities/service-staff.ts

/** Personal que ejecuta el servicio sin tener cuenta en la app: en una
    lavadora, quién lava y quién seca. `both` hace los dos puestos, que es
    lo normal — el mismo tipo lava un auto y seca el siguiente. */
export type StaffPosition = 'washer' | 'dryer' | 'both';

export interface ServiceStaff {
  id: string;
  name: string;
  position: StaffPosition;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateServiceStaffInput {
  name: string;
  position: StaffPosition;
  isActive?: boolean;
}

export interface UpdateServiceStaffInput extends Partial<CreateServiceStaffInput> {}

export const STAFF_POSITION_LABEL: Record<StaffPosition, string> = {
  washer: 'Lavador',
  dryer: 'Secador',
  both: 'Ambos',
};
```

- [ ] **Step 2: Write the repository interface**

```ts
// apps/admin-v2/src/domain/repositories/service-staff.repository.ts

import type {
  ServiceStaff,
  CreateServiceStaffInput,
  UpdateServiceStaffInput,
  StaffPosition,
} from '@/domain/entities/service-staff';

export interface ServiceStaffRepository {
  /** `position` pide los de ese puesto más los de puesto `both`. */
  list(position?: StaffPosition): Promise<ServiceStaff[]>;
  create(input: CreateServiceStaffInput): Promise<ServiceStaff>;
  update(id: string, input: UpdateServiceStaffInput): Promise<ServiceStaff>;
}
```

- [ ] **Step 3: Write the api repository**

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-service-staff.repository.ts

import api from '@/infrastructure/api/client';
import type {
  ServiceStaff,
  CreateServiceStaffInput,
  UpdateServiceStaffInput,
  StaffPosition,
} from '@/domain/entities/service-staff';
import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';

function mapStaff(raw: Record<string, unknown>): ServiceStaff {
  return {
    id: raw.id as string,
    name: raw.name as string,
    position: raw.position as StaffPosition,
    isActive: raw.is_active as boolean,
    createdAt: new Date(raw.created_at as string),
  };
}

export class ApiServiceStaffRepository implements ServiceStaffRepository {
  async list(position?: StaffPosition): Promise<ServiceStaff[]> {
    const { data: res } = await api.get<{ data: Record<string, unknown>[] }>(
      '/service-staff',
      { params: position ? { position } : undefined },
    );
    return res.data.map(mapStaff);
  }

  async create(input: CreateServiceStaffInput): Promise<ServiceStaff> {
    const { data: res } = await api.post<{ data: Record<string, unknown> }>('/service-staff', {
      name: input.name,
      position: input.position,
      is_active: input.isActive ?? true,
    });
    return mapStaff(res.data);
  }

  async update(id: string, input: UpdateServiceStaffInput): Promise<ServiceStaff> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.position !== undefined) payload.position = input.position;
    if (input.isActive !== undefined) payload.is_active = input.isActive;

    const { data: res } = await api.patch<{ data: Record<string, unknown> }>(
      `/service-staff/${id}`,
      payload,
    );
    return mapStaff(res.data);
  }
}
```

- [ ] **Step 4: Write the three use cases**

```ts
// apps/admin-v2/src/application/use-cases/service-staff/list-service-staff.use-case.ts

import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';
import type { ServiceStaff, StaffPosition } from '@/domain/entities/service-staff';

export class ListServiceStaffUseCase {
  constructor(private repo: ServiceStaffRepository) {}
  execute(position?: StaffPosition): Promise<ServiceStaff[]> {
    return this.repo.list(position);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/service-staff/create-service-staff.use-case.ts

import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';
import type { ServiceStaff, CreateServiceStaffInput } from '@/domain/entities/service-staff';

export class CreateServiceStaffUseCase {
  constructor(private repo: ServiceStaffRepository) {}
  execute(input: CreateServiceStaffInput): Promise<ServiceStaff> {
    return this.repo.create(input);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/service-staff/update-service-staff.use-case.ts

import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';
import type { ServiceStaff, UpdateServiceStaffInput } from '@/domain/entities/service-staff';

export class UpdateServiceStaffUseCase {
  constructor(private repo: ServiceStaffRepository) {}
  execute(id: string, input: UpdateServiceStaffInput): Promise<ServiceStaff> {
    return this.repo.update(id, input);
  }
}
```

- [ ] **Step 5: Register the repository in the provider**

En `repository.provider.tsx`: agregá `serviceStaff: ServiceStaffRepository;` a
la interfaz de repositorios (junto a `businessResource`, línea ~59), y
`serviceStaff: new ApiServiceStaffRepository(),` al objeto que la instancia
(línea ~84). Sumá los dos imports correspondientes.

- [ ] **Step 6: Write the hooks**

```ts
// apps/admin-v2/src/presentation/hooks/use-service-staff.ts

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { ListServiceStaffUseCase } from '@/application/use-cases/service-staff/list-service-staff.use-case';
import { CreateServiceStaffUseCase } from '@/application/use-cases/service-staff/create-service-staff.use-case';
import { UpdateServiceStaffUseCase } from '@/application/use-cases/service-staff/update-service-staff.use-case';
import type {
  CreateServiceStaffInput,
  UpdateServiceStaffInput,
  StaffPosition,
} from '@/domain/entities/service-staff';

export function useServiceStaff(position?: StaffPosition) {
  const repo = useRepository('serviceStaff');
  return useQuery({
    queryKey: ['service-staff', position ?? 'all'],
    queryFn: () => new ListServiceStaffUseCase(repo).execute(position),
  });
}

export function useCreateServiceStaff() {
  const repo = useRepository('serviceStaff');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceStaffInput) =>
      new CreateServiceStaffUseCase(repo).execute(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-staff'] }),
  });
}

export function useUpdateServiceStaff() {
  const repo = useRepository('serviceStaff');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateServiceStaffInput }) =>
      new UpdateServiceStaffUseCase(repo).execute(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-staff'] }),
  });
}
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/src/domain/entities/service-staff.ts \
        apps/admin-v2/src/domain/repositories/service-staff.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-service-staff.repository.ts \
        apps/admin-v2/src/application/use-cases/service-staff/ \
        apps/admin-v2/src/presentation/hooks/use-service-staff.ts \
        apps/admin-v2/src/infrastructure/providers/repository.provider.tsx
git commit -m "feat(admin): service-staff data layer"
```

---

### Task 10: Pestaña "Personal" en Configuración

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/settings/staff-tab.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/settings/page.tsx`

**Interfaces:**
- Consumes: `useServiceStaff`, `useCreateServiceStaff`, `useUpdateServiceStaff` (Task 9), `useSettings` para `businessType`.
- Produces: `StaffTab`, montada en la pestaña `staff`.

- [ ] **Step 1: Write the tab**

```tsx
// apps/admin-v2/src/presentation/components/features/settings/staff-tab.tsx

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { apiErrorMessage } from '@/shared/utils/api-error';
import {
  useServiceStaff,
  useCreateServiceStaff,
  useUpdateServiceStaff,
} from '@/presentation/hooks/use-service-staff';
import { STAFF_POSITION_LABEL, type StaffPosition } from '@/domain/entities/service-staff';

const POSITIONS: StaffPosition[] = ['washer', 'dryer', 'both'];

export function StaffTab() {
  const { data: staff, isLoading } = useServiceStaff();
  const create = useCreateServiceStaff();
  const update = useUpdateServiceStaff();

  const [name, setName] = useState('');
  const [position, setPosition] = useState<StaffPosition>('both');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Escribí un nombre');
      return;
    }

    create.mutate({ name: trimmed, position }, {
      onSuccess: () => {
        toast.success('Personal agregado');
        setName('');
        setPosition('both');
      },
      onError: (e) => toast.error(apiErrorMessage(e, 'Error al agregar')),
    });
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  const rows = staff ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Personal de lavado</CardTitle>
        <p className="text-xs text-[var(--fg-muted)]">
          Quién lava y quién seca. No son usuarios de la app: no tienen contraseña
          y no cuentan contra el límite de empleados de tu plan. Se desactivan, no
          se borran — los servicios que ya hicieron tienen que seguir nombrándolos.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alta: un nombre y un puesto. El punto de que no sean cuentas es
            que agregar a alguien sea esto y no una invitación. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="Nombre y apellido"
            className="sm:flex-1"
            aria-label="Nombre del personal"
          />
          <Select value={position} onValueChange={(v) => setPosition(v as StaffPosition)}>
            <SelectTrigger className="sm:w-40" aria-label="Puesto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>{STAFF_POSITION_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={create.isPending} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Agregar
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--fg-secondary)]">
              Todavía no registraste personal. Agregá al primero arriba para poder
              asignar lavador y secador en el Registro Diario.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-[var(--border-soft)] rounded-lg border border-[var(--border)]">
            {rows.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className={cn(
                    'truncate text-[14px] font-medium',
                    person.isActive ? 'text-[var(--fg-strong)]' : 'text-[var(--fg-muted)] line-through',
                  )}>
                    {person.name}
                  </p>
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    {STAFF_POSITION_LABEL[person.position]}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={person.position}
                    onValueChange={(v) =>
                      update.mutate(
                        { id: person.id, input: { position: v as StaffPosition } },
                        {
                          onSuccess: () => toast.success('Puesto actualizado'),
                          onError: (e) => toast.error(apiErrorMessage(e, 'Error al actualizar')),
                        },
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-32" aria-label={`Puesto de ${person.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>{STAFF_POSITION_LABEL[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: person.id, input: { isActive: !person.isActive } },
                        {
                          onSuccess: () =>
                            toast.success(person.isActive ? 'Desactivado' : 'Activado'),
                          onError: (e) => toast.error(apiErrorMessage(e, 'Error al actualizar')),
                        },
                      )
                    }
                  >
                    {person.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount the tab, car_wash only**

En `settings/page.tsx`:

1. Importá `Users` de `lucide-react` (sumalo a la lista existente) y
   `import { StaffTab } from '@/presentation/components/features/settings/staff-tab';`
2. Importá `useSettings`: `import { useSettings } from '@/presentation/hooks/use-settings';`
3. Convertí `TABS` en una función, porque ahora depende del rubro:

```tsx
const BASE_TABS = [
  { value: 'general', label: 'General', icon: Settings },
  { value: 'schedule', label: 'Horario', icon: Clock },
  { value: 'gallery', label: 'Galería', icon: Image },
  { value: 'fields', label: 'Campos', icon: List },
  { value: 'permissions', label: 'Permisos', icon: Shield },
  { value: 'brand', label: 'Marca', icon: Palette },
  { value: 'billing', label: 'Facturación', icon: Receipt },
  { value: 'resources', label: 'Recursos', icon: Layers },
] as const;

// El personal de lavado es vocabulario de lavadora: en los demás rubros la
// pestaña no existe.
const STAFF_TAB = { value: 'staff', label: 'Personal', icon: Users } as const;
```

4. Dentro de `SettingsContent`:

```tsx
  const { data: settings } = useSettings();
  const isCarWash = settings?.businessType === 'car_wash';
  const TABS = isCarWash ? [...BASE_TABS, STAFF_TAB] : BASE_TABS;
```

5. Agregá el contenido junto a los demás `TabsContent`:

```tsx
            {isCarWash && (
              <TabsContent value="staff" className="mt-0"><StaffTab /></TabsContent>
            )}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 4: Verify in the browser**

Levantá el stack (`cd apps/backend && composer dev` y
`cd apps/admin-v2 && npm run dev`), entrá como owner de un tenant `car_wash` a
Configuración → Personal, y comprobá: agregar con Enter, cambiar puesto,
desactivar (el nombre queda tachado y sigue en la lista), y que en un tenant
que no sea `car_wash` la pestaña no aparezca.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/settings/staff-tab.tsx \
        "apps/admin-v2/src/presentation/app/(tenant)/settings/page.tsx"
git commit -m "feat(admin): Personal tab to register washers and dryers"
```

---

### Task 11: Privilegio `Asignados` en la matriz

**Files:**
- Modify: `apps/admin-v2/src/shared/constants/permissions.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-permissions.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `PRIVILEGES` pasa a `['Precio', 'Eliminar', 'Asignados']`, y `usePermissions()` devuelve además `canAssign(isCompleted: boolean): boolean`.

El editor de la matriz (`permissions-tab.tsx`) **no se toca**: ya itera
`PRIVILEGES`, así que la columna aparece sola con su ciclo de dos estados.

- [ ] **Step 1: Add the privilege to the constants**

En `permissions.ts`:

```ts
export const PRIVILEGES = ['Precio', 'Eliminar', 'Asignados'] as const;
```

y agregá la clave a las cuatro filas de `DEFAULT_PERMISSIONS`. Ojo con la
asimetría: el cajero **sí** asigna, aunque no pueda precio ni borrado.

```ts
  Admin: {
    // …
    Precio: 'full', Eliminar: 'full', Asignados: 'full',
  },
  Cajero: {
    // …
    Precio: 'none', Eliminar: 'none', Asignados: 'full',
  },
  Lavador: {
    // …
    Precio: 'none', Eliminar: 'none', Asignados: 'none',
  },
  Cliente: {
    // …
    Precio: 'none', Eliminar: 'none', Asignados: 'none',
  },
```

- [ ] **Step 2: Add canAssign to the hook**

En `use-permissions.ts`, después de la definición de `hasPrivilege`:

```ts
  /**
   * Asignar lavador y secador. En progreso lo gobierna la matriz; una vez
   * completado es owner/admin y nada más — regla fija, no configurable, para
   * que el rastro no se pueda devolver al mostrador donde entra el reclamo.
   */
  function canAssign(isCompleted: boolean): boolean {
    if (isCompleted) {
      return role === 'owner' || role === 'tenant_admin';
    }
    return hasPrivilege('Asignados');
  }
```

y agregalo al objeto que devuelve el hook:

```ts
  return {
    canAccess,
    hasPrivilege,
    canSetPrice: hasPrivilege('Precio'),
    canDeleteLog: hasPrivilege('Eliminar'),
    canAssign,
  };
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 4: Verify in the browser**

Configuración → Permisos: la tabla tiene ahora tres columnas bajo "Registro
Diario" (PRECIO, ELIMINAR, ASIGNADOS), Cajero viene con ASIGNADOS en verde y
las otras dos en gris, y la celda alterna entre dos estados y no tres.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/shared/constants/permissions.ts \
        apps/admin-v2/src/presentation/hooks/use-permissions.ts
git commit -m "feat(permisos): Asignados joins the matrix, granted to the cashier by default"
```

---

### Task 12: Lavador y secador al registrar

**Files:**
- Modify: `apps/admin-v2/src/domain/entities/service-log.ts`
- Modify: `apps/admin-v2/src/domain/repositories/service-log.repository.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/new-service-modal.tsx`

**Interfaces:**
- Consumes: `useServiceStaff` (Task 9), `useSettings` para `businessType`.
- Produces: `ServiceLog` gana `washedBy: string | null`, `driedBy: string | null`, `washer?: { id, name } | null`, `dryer?: { id, name } | null`. `CreateServiceLogData` gana `washedBy?: string | null` y `driedBy?: string | null`.

- [ ] **Step 1: Extend the entity**

En `service-log.ts`, después de `attendedBy: string;`:

```ts
  /** Catálogo service_staff, no usuarios: quién lavó y quién secó. Solo
      car_wash los usa. */
  washedBy: string | null;
  driedBy: string | null;
```

y junto a `attendant?: ServiceLogAttendant;` en la interfaz `ServiceLog`:

```ts
  washer?: { id: string; name: string } | null;
  dryer?: { id: string; name: string } | null;
```

- [ ] **Step 2: Extend the mapper**

En `service-log.mapper.ts`, agregá al objeto que arma el `ServiceLog`:

```ts
    washedBy: (raw.washed_by as string | null) ?? null,
    driedBy: (raw.dried_by as string | null) ?? null,
    washer: (raw.washer as { id: string; name: string } | null) ?? null,
    dryer: (raw.dryer as { id: string; name: string } | null) ?? null,
```

Leé el archivo antes de editarlo para copiar el estilo exacto de casteo que ya
usa (el mapper actual castea con `as` y aplica `?? null`).

- [ ] **Step 3: Extend the create payload**

En `service-log.repository.ts`, agregá a `CreateServiceLogData`:

```ts
  washedBy?: string | null;
  driedBy?: string | null;
```

En `api-service-log.repository.ts`, en el método `create`, agregá al body que
se manda (junto a `attended_by`):

```ts
      washed_by: data.washedBy ?? null,
      dried_by: data.driedBy ?? null,
```

- [ ] **Step 4: Swap the Empleado select in the modal**

En `new-service-modal.tsx`:

1. Importá los hooks y tipos:
   ```tsx
   import { useServiceStaff } from '@/presentation/hooks/use-service-staff';
   ```
2. Dentro del componente, junto a los demás hooks:
   ```tsx
   const isCarWash = settings?.businessType === 'car_wash';
   const { data: washers } = useServiceStaff('washer');
   const { data: dryers } = useServiceStaff('dryer');
   const [washedBy, setWashedBy] = useState('');
   const [driedBy, setDriedBy] = useState('');
   ```
   (`settings` ya está en scope vía `useSettings()`.)
3. Localizá el bloque del select "Empleado" (el `<label>Empleado</label>` con
   su `<Select value={effectiveAttendedBy} …>`). Envolvelo en `{!isCarWash && (
   … )}` y agregá al lado el bloque nuevo:

```tsx
        {isCarWash && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Lavador{' '}
                <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                  (opcional)
                </span>
              </label>
              <Select value={washedBy} onValueChange={setWashedBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {(washers ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Secador{' '}
                <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                  (opcional)
                </span>
              </label>
              <Select value={driedBy} onValueChange={setDriedBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {(dryers ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
```

4. En el submit, agregá los dos campos al payload de `createMutation.mutate`:

```tsx
        washedBy: isCarWash && washedBy ? washedBy : null,
        driedBy: isCarWash && driedBy ? driedBy : null,
```

5. `attended_by` sigue siendo obligatorio en el backend. Al desaparecer el
   select en car_wash hay que mandar el usuario que registra: en el payload,
   donde hoy va `attendedBy: effectiveAttendedBy`, dejá

```tsx
        attendedBy: isCarWash ? (me?.user?.id ?? '') : effectiveAttendedBy,
```

6. Donde el modal valida que haya empleado elegido antes de habilitar el submit,
   excluí ese requisito en car_wash — ahí el empleado ya no se elige.

- [ ] **Step 5: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 6: Verify in the browser**

En un tenant `car_wash`: "Registrar servicio" muestra Lavador y Secador y ya no
muestra Empleado; se puede guardar sin elegir a nadie; eligiendo a los dos, el
registro queda con ellos. En un tenant `barbershop` el modal sigue exactamente
como antes.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-v2/src/domain/entities/service-log.ts \
        apps/admin-v2/src/domain/repositories/service-log.repository.ts \
        apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts \
        apps/admin-v2/src/presentation/components/features/service-logs/new-service-modal.tsx
git commit -m "feat(admin): pick washer and dryer when registering a service"
```

---

### Task 13: Dialog de asignación y su lugar en la lista

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/assign-staff-dialog.tsx`
- Modify: `apps/admin-v2/src/domain/repositories/service-log.repository.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-service-logs.ts`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx`

**Interfaces:**
- Consumes: `useServiceStaff` (Task 9), `canAssign` (Task 11), el endpoint de Task 6.
- Produces: `useAssignServiceLogStaff()` (mutación `{id, data: {washedBy?, driedBy?}}`), y `<AssignStaffDialog log={...} open onClose={...} />`.

- [ ] **Step 1: Add the repository method**

En `service-log.repository.ts`, agregá el tipo y el método a la interfaz:

```ts
export interface AssignStaffData {
  washedBy?: string | null;
  driedBy?: string | null;
}
```

```ts
  assignStaff(id: string, data: AssignStaffData): Promise<ServiceLog>;
```

En `api-service-log.repository.ts`:

```ts
  async assignStaff(id: string, data: AssignStaffData): Promise<ServiceLog> {
    // Omitir un campo es "no lo toques"; mandarlo en null es "sacá al
    // asignado". El backend distingue los dos casos.
    const payload: Record<string, unknown> = {};
    if (data.washedBy !== undefined) payload.washed_by = data.washedBy;
    if (data.driedBy !== undefined) payload.dried_by = data.driedBy;

    const { data: res } = await api.patch<{ data: Record<string, unknown> }>(
      `/service-logs/${id}/assignees`,
      payload,
    );
    return mapServiceLog(res.data);
  }
```

El mapper es `mapServiceLog`, ya importado en ese archivo desde
`../mappers/service-log.mapper`.

- [ ] **Step 2: Add the hook**

En `use-service-logs.ts`:

```ts
export function useAssignServiceLogStaff() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignStaffData }) =>
      repo.assignStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}
```

Sumá `AssignStaffData` al import de tipos que ya trae el archivo desde
`@/domain/repositories/service-log.repository`.

- [ ] **Step 3: Write the dialog**

```tsx
// apps/admin-v2/src/presentation/components/features/service-logs/assign-staff-dialog.tsx

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { useServiceStaff } from '@/presentation/hooks/use-service-staff';
import { useAssignServiceLogStaff } from '@/presentation/hooks/use-service-logs';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import type { ServiceLog } from '@/domain/entities/service-log';

interface Props {
  log: ServiceLog;
  open: boolean;
  onClose: () => void;
  /** Mensaje que explica por qué se abrió solo, cuando viene de Completar. */
  reason?: string;
}

/**
 * Asignar lavador y secador. Camino propio y no el editor completo porque es
 * la acción del día: se asigna al lavador cuando arranca y al secador cuando
 * seca, dos veces por auto.
 */
export function AssignStaffDialog({ log, open, onClose, reason }: Props) {
  const { data: washers } = useServiceStaff('washer');
  const { data: dryers } = useServiceStaff('dryer');
  const assign = useAssignServiceLogStaff();
  const { canAssign } = usePermissions();

  const locked = !canAssign(log.status === 'completed');

  const [washedBy, setWashedBy] = useState('');
  const [driedBy, setDriedBy] = useState('');

  useEffect(() => {
    if (!open) return;
    setWashedBy(log.washedBy ?? '');
    setDriedBy(log.driedBy ?? '');
  }, [open, log.washedBy, log.driedBy]);

  function handleSave() {
    assign.mutate(
      {
        id: log.id,
        data: {
          washedBy: washedBy || null,
          driedBy: driedBy || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Asignados actualizados');
          onClose();
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Error al asignar')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar personal</DialogTitle>
          <DialogDescription>
            {reason ?? 'Quién lavó y quién secó este vehículo.'}
          </DialogDescription>
        </DialogHeader>

        {locked && (
          <p className="rounded-lg bg-[var(--warning-50)] px-3 py-2 text-[12.5px] text-[var(--warning-700)]">
            El servicio está completado: solo el administrador puede corregir los
            asignados.
          </p>
        )}

        <div className="flex flex-col gap-4 py-1">
          <div>
            <Label className="mb-1.5 block">Lavador</Label>
            <Select value={washedBy} onValueChange={setWashedBy} disabled={locked}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {(washers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Secador</Label>
            <Select value={driedBy} onValueChange={setDriedBy} disabled={locked}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {(dryers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assign.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={locked || assign.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Wire it into the list**

En `log-list.tsx`:

1. Importá el dialog, `useSettings` y sumá `canAssign` al destructuring de
   `usePermissions()`.
2. Estado nuevo: `const [assignTarget, setAssignTarget] = useState<{ log: ServiceLog; reason?: string } | null>(null);`
3. `const isCarWash = settings?.businessType === 'car_wash';`
4. **Columna EMPLEADO**: reemplazá el `<span>` que muestra `log.attendant?.name`
   por:

```tsx
            <div className="hidden lg:block">
              {isCarWash ? (
                <>
                  <p className="truncate text-[13px] text-[var(--fg-secondary)]">
                    {log.washer?.name ?? (
                      <span className="text-[var(--fg-muted)]">Sin asignar</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)]">
                    {log.dryer?.name ?? 'Sin secador'}
                  </p>
                </>
              ) : (
                <span className="truncate text-[13px] text-[var(--fg-secondary)]">
                  {log.attendant?.name ?? '-'}
                </span>
              )}
            </div>
```

5. **Menú ⋯**: agregá el item antes de "Editar", solo en car_wash:

```tsx
                  {isCarWash && (
                    <DropdownMenuItem onClick={() => setAssignTarget({ log })}>
                      <UserCog className="mr-2 h-3.5 w-3.5" />
                      Asignar
                    </DropdownMenuItem>
                  )}
```

(importá `UserCog` de `lucide-react`.)

6. **Completar**: cambiá `handleComplete` para que, en car_wash y sin
   asignados, abra el dialog en vez de pegarle al endpoint:

```tsx
  function handleComplete(log: ServiceLog) {
    // El 422 del backend es la red de seguridad, no la experiencia: si falta
    // alguien, pedilo acá mismo.
    if (isCarWash && (!log.washedBy || !log.driedBy)) {
      setAssignTarget({
        log,
        reason: 'Asigná lavador y secador para poder completar el servicio.',
      });
      return;
    }

    completeMutation.mutate(log.id, {
      onSuccess: () => toast.success('Servicio completado'),
      onError: (e) => toast.error(apiErrorMessage(e, 'Error al completar')),
    });
  }
```

Actualizá las dos llamadas (`onClick={() => handleComplete(log.id)}` en el
botón y en el item del menú) a `handleComplete(log)`.

7. Renderizá el dialog junto a los otros dos del final:

```tsx
      {assignTarget && isCarWash && (
        <AssignStaffDialog
          log={assignTarget.log}
          reason={assignTarget.reason}
          open
          onClose={() => setAssignTarget(null)}
        />
      )}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 6: Verify in the browser**

Como cajero de un tenant `car_wash`: ⋯ → Asignar guarda; Completar sin
asignados abre el dialog con el mensaje; completar con los dos funciona;
después de completado, ⋯ → Asignar muestra el aviso y los selects
deshabilitados. Como admin, después de completado el dialog deja corregir.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/service-logs/assign-staff-dialog.tsx \
        apps/admin-v2/src/domain/repositories/service-log.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts \
        apps/admin-v2/src/presentation/hooks/use-service-logs.ts \
        apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx
git commit -m "feat(admin): assign dialog, and Completar asks for the names it needs"
```

---

### Task 14: Asignados y bitácora en el detalle

**Files:**
- Create: `apps/admin-v2/src/shared/utils/service-log-events.ts`
- Modify: `apps/admin-v2/src/domain/entities/service-log.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/service-log/[id]/page.tsx`

**Interfaces:**
- Consumes: `events` del endpoint de Task 8, `AssignStaffDialog` (Task 13), `canAssign` (Task 11).
- Produces: `ServiceLogEvent` en el dominio y `describeServiceLogEvent(event: ServiceLogEvent): string`.

- [ ] **Step 1: Extend the entity**

En `service-log.ts`:

```ts
export interface ServiceLogEvent {
  id: string;
  event:
    | 'created'
    | 'assignee_changed'
    | 'items_changed'
    | 'payment_recorded'
    | 'status_changed'
    | 'invoice_requested'
    | 'invoice_status_changed';
  detail: Record<string, unknown>;
  changedAt: Date;
  /** Null = lo hizo el sistema (el veredicto del SRI). */
  changedBy: { id: string; name: string } | null;
}
```

y en la interfaz `ServiceLog`: `events?: ServiceLogEvent[];`

- [ ] **Step 2: Extend the mapper**

```ts
    events: Array.isArray(raw.events)
      ? (raw.events as Record<string, unknown>[]).map((e) => ({
          id: e.id as string,
          event: e.event as ServiceLogEvent['event'],
          detail: (e.detail as Record<string, unknown>) ?? {},
          changedAt: new Date(e.changed_at as string),
          changedBy: (e.changed_by as { id: string; name: string } | null) ?? null,
        }))
      : undefined,
```

Importá el tipo `ServiceLogEvent` en el mapper.

- [ ] **Step 3: Write the formatter**

```ts
// apps/admin-v2/src/shared/utils/service-log-events.ts

import type { ServiceLogEvent } from '@/domain/entities/service-log';

const POSITION_LABEL: Record<string, string> = {
  washer: 'Lavador',
  dryer: 'Secador',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const INVOICE_LABEL: Record<string, string> = {
  pendiente: 'Factura pendiente',
  enviada: 'Factura enviada al SRI',
  autorizada: 'Factura autorizada',
  rechazada: 'Factura rechazada',
};

function money(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
}

/**
 * Una línea en castellano por evento. La bitácora se lee cuando entra un
 * reclamo, así que tiene que decir qué pasó sin que nadie traduzca claves.
 */
export function describeServiceLogEvent(event: ServiceLogEvent): string {
  const d = event.detail;

  switch (event.event) {
    case 'created':
      return 'Registró el servicio';

    case 'assignee_changed': {
      const position = POSITION_LABEL[String(d.position)] ?? 'Asignado';
      const from = (d.from_name as string | null) ?? '—';
      const to = (d.to_name as string | null) ?? '—';
      return `${position}: ${from} → ${to}`;
    }

    case 'items_changed':
      return `Cambió los servicios · ${money(d.total_before)} → ${money(d.total_after)}`;

    case 'payment_recorded': {
      const method = METHOD_LABEL[String(d.method)] ?? String(d.method);
      const bank = d.bank ? ` · ${String(d.bank)}` : '';
      return `Cobró ${money(d.amount)} · ${method}${bank}`;
    }

    case 'status_changed':
      return d.to === 'completed' ? 'Completó el servicio' : `Estado: ${String(d.to)}`;

    case 'invoice_requested':
      return 'Solicitó factura';

    case 'invoice_status_changed': {
      const label = INVOICE_LABEL[String(d.to)] ?? `Factura ${String(d.to)}`;
      return d.reason ? `${label}: ${String(d.reason)}` : label;
    }

    default:
      return event.event;
  }
}
```

- [ ] **Step 4: Add the two cards to the detail page**

En `service-log/[id]/page.tsx`, dentro de la columna derecha y después de la
`<Card title="Tiempos">`:

```tsx
          {isCarWash && (
            <Card title="Asignados">
              <Row label="Lavador" value={log.washer?.name ?? 'Sin asignar'} />
              <Row label="Secador" value={log.dryer?.name ?? 'Sin asignar'} />
              {canAssign(log.status === 'completed') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setAssignOpen(true)}
                >
                  Cambiar
                </Button>
              )}
            </Card>
          )}

          {(log.events ?? []).length > 0 && (
            <Card title="Bitácora">
              <ol className="space-y-2.5">
                {(log.events ?? []).map((event) => (
                  <li key={event.id} className="border-l-2 border-[var(--border)] pl-2.5">
                    <p className="text-[12.5px] text-[var(--fg-strong)]">
                      {describeServiceLogEvent(event)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)]">
                      {format(event.changedAt, "d MMM, HH:mm", { locale: es })}
                      {' · '}
                      {event.changedBy?.name ?? 'SRI'}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
```

Agregá al componente:

```tsx
  const [assignOpen, setAssignOpen] = useState(false);
  const { canAssign } = usePermissions();
  const { data: settings } = useSettings();
  const isCarWash = settings?.businessType === 'car_wash';
```

y el dialog junto a los otros que la página ya renderiza:

```tsx
      {assignOpen && (
        <AssignStaffDialog log={log} open onClose={() => setAssignOpen(false)} />
      )}
```

Sumá los imports que falten: `describeServiceLogEvent`, `AssignStaffDialog`,
`usePermissions`, `useSettings`, y `format` / `es` de `date-fns` si la página
todavía no los trae.

- [ ] **Step 5: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 6: Verify in the browser**

Abrí un servicio que ya tenga historia (registrado, asignado, cobrado,
completado, facturado) y comprobá que la bitácora los muestre en orden, que el
evento del SRI diga "SRI" y no una persona, y que "Cambiar" no aparezca para un
cajero en un servicio completado.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-v2/src/shared/utils/service-log-events.ts \
        apps/admin-v2/src/domain/entities/service-log.ts \
        apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts \
        "apps/admin-v2/src/presentation/app/(tenant)/service-log/[id]/page.tsx"
git commit -m "feat(admin): assignees and the trail on the service detail"
```

---

### Task 15: Las filas del vehículo llevan al servicio

**Files:**
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/clients/[id]/page.tsx:306-342`

**Interfaces:**
- Consumes: nada nuevo. El `id` de cada fila del historial ya es el del service log (lo devuelve `ClientResourceController::history`).
- Produces: nada. Cierra el circuito del reclamo.

- [ ] **Step 1: Make the rows navigate**

Reemplazá el `<li>` de la pestaña Servicios por un `<li>` con un `<button>`
que ocupe la fila. Botón y no `<div onClick>` para que el teclado y los
lectores de pantalla lo alcancen:

```tsx
              {serviceHistory.map((item) => (
                <li key={item.id}>
                  {/* Cuando el dueño de un vehículo reclama, este click es el
                      camino al detalle: qué se le hizo, quién lo lavó, quién
                      lo secó y si alguien tocó algo después. */}
                  <button
                    type="button"
                    onClick={() => router.push(`/service-logs/${item.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[var(--fg-strong)]">
                        {item.serviceName ?? 'Servicio'}
                      </p>
                      <p className="text-[12.5px] text-[var(--fg-secondary)]">
                        {format(new Date(item.date), "d 'de' MMMM yyyy · HH:mm", { locale: es })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {item.amount != null && (
                        <span
                          className="text-[14px] font-bold tabular-nums text-[var(--fg-strong)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {fmt(item.amount)}
                        </span>
                      )}
                      {item.status && (
                        <span
                          className={cn(
                            'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em]',
                            item.status === 'completed'
                              ? 'bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]'
                              : 'bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]'
                          )}
                        >
                          {item.status === 'completed' ? 'Completado' : 'En progreso'}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
```

`router` ya está en scope (la página lo usa para volver a `/clients`).

- [ ] **Step 2: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin salida

- [ ] **Step 3: Verify in the browser**

Clientes → un vehículo → pestaña Servicios → click en una fila: cae en el
detalle de ese servicio. Tab llega al botón y Enter navega.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin-v2/src/presentation/app/(tenant)/clients/[id]/page.tsx"
git commit -m "feat(admin): a vehicle's service rows open the service"
```

---

### Task 16: Verificación local del flujo completo

**Files:**
- Ninguno. Es la corrida que el usuario pidió antes de desplegar.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la evidencia para decidir el deploy.

- [ ] **Step 1: Run the full backend suite**

Run: `cd apps/backend && composer test`
Expected: los **9 fallos pre-existentes** y ninguno más. Anotá el número total
de tests que pasan.

- [ ] **Step 2: Build the admin**

Run: `cd apps/admin-v2 && npm run build`
Expected: build exitoso. Este es el gate que rompió producción antes — corrélo
hasta el final, sin timeout.

- [ ] **Step 3: Migrate a real database**

Run: `cd apps/backend && php artisan migrate`
Expected: las tres migraciones nuevas corren limpias sobre MySQL local (SQLite
en memoria no prueba las FK ni el `after()` de las columnas).

- [ ] **Step 4: Walk the flow**

Levantá `composer dev` y `npm run dev`, entrá con un tenant `car_wash`, y
recorré en orden:

1. Configuración → Personal: agregá un lavador, un secador y uno "Ambos".
2. Configuración → Permisos: confirmá la columna ASIGNADOS y que Cajero la
   tenga en verde.
3. Registrar servicio sin asignar a nadie → se guarda.
4. La fila muestra "Sin asignar / Sin secador".
5. ⋯ → Asignar → poné el lavador. La fila lo muestra.
6. Completar → se abre el dialog pidiendo el secador.
7. Asigná el secador y completá → pasa.
8. Como cajero, ⋯ → Asignar en el servicio completado → aviso y selects
   deshabilitados.
9. Como admin, cambiá el lavador del servicio completado → pasa.
10. Abrí el detalle: ASIGNADOS al día y BITÁCORA con registro, las tres
    asignaciones, el cobro y el completado, cada uno con autor y hora.
11. Facturá y volvé al detalle: aparecen "Solicitó factura" y el veredicto del
    SRI atribuido a "SRI".
12. Clientes → el vehículo → Servicios → click: cae en ese detalle.
13. Cambiá el tenant a uno que no sea `car_wash` y confirmá que no hay pestaña
    Personal, que el modal sigue con "Empleado", y que completar no pide nada.

- [ ] **Step 5: Report**

Contá qué pasó en cada punto. Cualquier desvío se arregla antes del deploy, no
después.

---

## Notas de ejecución

**Orden.** Las tareas 1→8 son backend y hay que hacerlas en orden: cada una se
apoya en las columnas o el escritor de la anterior. Las 9→15 son admin y
dependen de que el backend esté listo, pero entre ellas la 15 es independiente
(no toca nada nuevo) y se puede hacer en cualquier momento.

**El fallo pre-existente que va a confundir.** `ServiceLogTest > create service
log requires required fields` falla **desde antes** de este trabajo: espera un
error de validación para `payment_method` que el request no exige. No lo
arregles acá; no es de este cambio.

**Si `ServiceLogTest` empieza a fallar en el complete.** Task 7 agrega el gate
de asignados solo para `car_wash`. Si algún test viejo rompe, revisá el
`business_type` que crea `TenantModel::factory()`: si por defecto fuera
`car_wash`, esos tests necesitan asignados. La solución correcta es pasar un
`business_type` explícito en el test que rompió, no debilitar el gate.

**Una divergencia deliberada con el spec.** El spec menciona
`GET /service-staff?active=1`. No se construye: el filtro `?position=` que sí
existe ya devuelve solo activos (`forPosition` lo incluye), y la pestaña
Personal necesita ver también a los desactivados para poder reactivarlos. Un
`?active=1` que nadie llama es superficie de API sin dueño.

**Deploy.** El usuario dijo que se despliega de noche, después de probar local.
El flujo de este repo es commit en `main` → push (backend por GitHub Actions,
admin por Vercel). Hay tres migraciones nuevas: el workflow de producción corre
`artisan down`, `migrate`, `artisan up`, así que la ventana de indisponibilidad
es real y corta. No desplegar sin el paso 4 de Task 16 completo.
