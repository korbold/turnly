# Roles y Recursos de Negocio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce role-based sidebar visibility so employees only see what their permissions allow, and introduce configurable business resources (stations, chairs, rooms) per tenant so reservations can be scoped to a physical or human resource.

**Architecture:** Phase 1 wires the existing `TenantSettings.permissions` matrix to the sidebar — no backend changes needed. Phase 2 adds a `business_resources` table (backend) and a full CRUD UI (frontend) with an optional `employee_id` link for barbershop/spa "choose your stylist" flows. Phase 3 adds a `allow_client_resource_selection` tenant setting and updates the public booking flow.

**Tech Stack:** Laravel 13 (PHP, Pest), Next.js 16 App Router, React Query, TypeScript, Tailwind v4, shadcn/ui.

## Global Constraints

- Backend: Clean Architecture — Domain → Application → Infrastructure. No framework imports in Domain layer.
- Backend: Models live in `app/Infrastructure/Persistence/Models/`, use `HasUuids`, `BelongsToTenant`.
- Backend: Always use `config()` not `env()` in app code.
- Frontend: Always use `useRepository()` + use-case pattern — no direct `api.*` calls in components.
- Frontend: Hooks live in `src/presentation/hooks/`, use React Query.
- Frontend: Read `apps/admin-v2/node_modules/next/dist/docs/` before writing any Next.js page code.
- Tests: Pest + SQLite in-memory. Run via `composer test` from `apps/backend/`.

---

## Phase 1 — Sidebar Role-Based Filtering

### Task 1: `usePermissions` hook

Maps the logged-in user's `UserRole` to the permissions matrix stored in `TenantSettings.permissions`, and exposes a `canAccess(href: string): boolean` function for the sidebar.

**Context you need:**
- `UserRole` = `'owner' | 'tenant_admin' | 'cashier' | 'washer' | 'client'` (`src/domain/entities/user.ts:1`)
- Permissions matrix keys use display names: `'Admin' | 'Cajero' | 'Lavador' | 'Cliente'` (`permissions-tab.tsx:11`)
- Matrix sections: `'Dashboard' | 'Reservas' | 'Registro' | 'Clientes' | 'Servicios' | 'Equipo' | 'Reportes' | 'Config'`
- `useMe()` → `{ user: User, tenant: Tenant }` (`src/presentation/hooks/use-auth.ts:14`)
- `useSettings()` → `TenantSettings` with `.permissions: Record<string, Record<string, string>>` (`src/presentation/hooks/use-settings.ts:16`)

**Files:**
- Create: `apps/admin-v2/src/presentation/hooks/use-permissions.ts`

**Interfaces:**
- Produces: `usePermissions(): { canAccess: (href: string) => boolean }`

- [ ] **Step 1: Create the hook**

```typescript
// apps/admin-v2/src/presentation/hooks/use-permissions.ts
'use client';

import { useMe } from '@/presentation/hooks/use-auth';
import { useSettings } from '@/presentation/hooks/use-settings';
import type { UserRole } from '@/domain/entities/user';

// Maps UserRole code → permissions matrix display key
const ROLE_TO_MATRIX: Partial<Record<UserRole, string>> = {
  tenant_admin: 'Admin',
  cashier: 'Cajero',
  washer: 'Lavador',
  client: 'Cliente',
};

// Maps sidebar href → permissions matrix section key.
// undefined means the section is not in the matrix —
// restricted roles (washer/cashier) will not see it.
const HREF_TO_SECTION: Record<string, string | undefined> = {
  '/dashboard': 'Dashboard',
  '/reservations': 'Reservas',
  '/service-logs': 'Registro',
  '/clients': 'Clientes',
  '/services': 'Servicios',
  '/inventory': undefined,
  '/team': 'Equipo',
  '/reports': 'Reportes',
  '/plan': undefined,
  '/settings': 'Config',
};

const RESTRICTED_ROLES: UserRole[] = ['washer', 'cashier'];

export function usePermissions() {
  const { data: me } = useMe();
  const { data: settings } = useSettings();

  function canAccess(href: string): boolean {
    const role = me?.user?.role;

    // Owner and admin always have full access.
    if (!role || role === 'owner' || role === 'tenant_admin') return true;

    // Clients should never access the admin panel.
    if (role === 'client') return false;

    // For restricted roles, check the matrix.
    if (RESTRICTED_ROLES.includes(role)) {
      const matrixKey = ROLE_TO_MATRIX[role];
      if (!matrixKey) return false;

      const section = HREF_TO_SECTION[href];
      // Section not in matrix (inventory, plan) → hide for restricted roles.
      if (!section) return false;

      const permission = settings?.permissions?.[matrixKey]?.[section] ?? 'none';
      return permission === 'full' || permission === 'view';
    }

    return true;
  }

  return { canAccess };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin-v2/src/presentation/hooks/use-permissions.ts
git commit -m "feat(admin): add usePermissions hook mapping role → sidebar access"
```

---

### Task 2: Sidebar filters nav items by permission

Wire `usePermissions` into `sidebar.tsx` so restricted employees only see their allowed sections.

**Files:**
- Modify: `apps/admin-v2/src/presentation/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `usePermissions(): { canAccess: (href: string) => boolean }` from Task 1

- [ ] **Step 1: Import and apply `usePermissions` in sidebar**

Open `apps/admin-v2/src/presentation/components/layout/sidebar.tsx`.

Add import at line 33 (after the existing `useMe, useLogout` import):
```typescript
import { usePermissions } from '@/presentation/hooks/use-permissions';
```

Inside `Sidebar()` function, add after line 80 (`const logout = useLogout();`):
```typescript
const { canAccess } = usePermissions();
```

Replace line 167–174 (the `mainNavItems.map(...)` block):
```typescript
{mainNavItems.filter((item) => canAccess(item.href)).map((item) => (
  <NavLink
    key={item.href}
    item={item}
    active={!!isActive(item.href)}
    collapsed={collapsed}
  />
))}
```

Replace line 182–187 (the `bottomNavItems.map(...)` block):
```typescript
{bottomNavItems.filter((item) => canAccess(item.href)).map((item) => (
  <NavLink
    key={item.href}
    item={item}
    active={!!isActive(item.href)}
    collapsed={collapsed}
  />
))}
```

- [ ] **Step 2: Manual smoke test**

1. Log in as an employee with `washer` role.
2. Verify sidebar hides Equipo, Inventario, Mi Plan, Reportes by default (matrix defaults all to `none` for Lavador — `permissions-tab.tsx:46-52`).
3. In Settings → Configuración → Permisos, grant Lavador access to Registro and Reservas.
4. Re-login (or wait for query refetch) — verify those two items now appear.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/components/layout/sidebar.tsx
git commit -m "feat(admin): filter sidebar nav by role permissions matrix"
```

---

## Phase 2 — Business Resources Backend

### Task 3: Migration + Domain entity

Creates the `business_resources` table and the domain entity. "Business resources" are the tenant's physical stations, rooms, or bookable people (vs `client_resources` which are client vehicles).

**Files:**
- Create: `apps/backend/database/migrations/2026_06_17_000001_create_business_resources_table.php`
- Create: `apps/backend/app/Domain/BusinessResource/Entities/BusinessResource.php`
- Create: `apps/backend/app/Domain/BusinessResource/Contracts/BusinessResourceRepositoryInterface.php`

**Interfaces:**
- Produces:
  - `BusinessResource` entity with fields: `id`, `tenantId`, `name`, `description`, `employeeId`, `type`, `isActive`, `sortOrder`
  - `BusinessResourceRepositoryInterface` with methods: `allForTenant(string $tenantId): array`, `findById(string $id): ?BusinessResource`, `save(BusinessResource $resource): BusinessResource`, `delete(string $id): void`

- [ ] **Step 1: Write migration**

```php
// apps/backend/database/migrations/2026_06_17_000001_create_business_resources_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_resources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignUuid('employee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['physical', 'person'])->default('physical');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_resources');
    }
};
```

- [ ] **Step 2: Run migration to verify it works**

```bash
cd apps/backend && php artisan migrate
```
Expected: `Migrating: 2026_06_17_000001_create_business_resources_table` + `Migrated` line.

- [ ] **Step 3: Write domain entity**

```php
// apps/backend/app/Domain/BusinessResource/Entities/BusinessResource.php
<?php

namespace App\Domain\BusinessResource\Entities;

final readonly class BusinessResource
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $name,
        public ?string $description,
        public ?string $employeeId,
        public string $type,
        public bool $isActive,
        public int $sortOrder,
    ) {}
}
```

- [ ] **Step 4: Write repository interface**

```php
// apps/backend/app/Domain/BusinessResource/Contracts/BusinessResourceRepositoryInterface.php
<?php

namespace App\Domain\BusinessResource\Contracts;

use App\Domain\BusinessResource\Entities\BusinessResource;

interface BusinessResourceRepositoryInterface
{
    /** @return BusinessResource[] */
    public function allForTenant(string $tenantId): array;

    public function findById(string $id): ?BusinessResource;

    public function save(BusinessResource $resource): BusinessResource;

    public function delete(string $id): void;
}
```

- [ ] **Step 5: Write failing test**

```php
// apps/backend/tests/Feature/BusinessResource/BusinessResourceCrudTest.php
<?php

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(RefreshDatabase::class);

it('can create and retrieve a business resource', function () {
    $tenant = \App\Infrastructure\Persistence\Models\TenantModel::factory()->create();
    $repo = app(BusinessResourceRepositoryInterface::class);

    $resource = new BusinessResource(
        id: (string) \Illuminate\Support\Str::uuid(),
        tenantId: $tenant->id,
        name: 'Estación 1',
        description: null,
        employeeId: null,
        type: 'physical',
        isActive: true,
        sortOrder: 0,
    );

    $saved = $repo->save($resource);
    $found = $repo->findById($saved->id);

    expect($found)->not->toBeNull();
    expect($found->name)->toBe('Estación 1');
    expect($found->type)->toBe('physical');
});

it('lists only resources for the given tenant', function () {
    $tenantA = \App\Infrastructure\Persistence\Models\TenantModel::factory()->create();
    $tenantB = \App\Infrastructure\Persistence\Models\TenantModel::factory()->create();
    $repo = app(BusinessResourceRepositoryInterface::class);

    foreach (['Silla 1', 'Silla 2'] as $i => $name) {
        $repo->save(new BusinessResource(
            id: (string) \Illuminate\Support\Str::uuid(),
            tenantId: $tenantA->id,
            name: $name,
            description: null,
            employeeId: null,
            type: 'physical',
            isActive: true,
            sortOrder: $i,
        ));
    }

    $repo->save(new BusinessResource(
        id: (string) \Illuminate\Support\Str::uuid(),
        tenantId: $tenantB->id,
        name: 'Estación B',
        description: null,
        employeeId: null,
        type: 'physical',
        isActive: true,
        sortOrder: 0,
    ));

    $results = $repo->allForTenant($tenantA->id);

    expect($results)->toHaveCount(2);
    expect(collect($results)->pluck('name')->all())->toContain('Silla 1', 'Silla 2');
});
```

- [ ] **Step 6: Run test to confirm it fails**

```bash
cd apps/backend && ./vendor/bin/pest tests/Feature/BusinessResource/BusinessResourceCrudTest.php -v
```
Expected: FAIL — `BusinessResourceRepositoryInterface` not bound.

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_06_17_000001_create_business_resources_table.php \
        app/Domain/BusinessResource/ \
        tests/Feature/BusinessResource/BusinessResourceCrudTest.php
git commit -m "feat(backend): business_resources migration + domain entity + failing test"
```

---

### Task 4: Eloquent model + repository implementation

Implements the repository interface with Eloquent, following the pattern from `EloquentServiceLogRepository`.

**Files:**
- Create: `apps/backend/app/Infrastructure/Persistence/Models/BusinessResourceModel.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentBusinessResourceRepository.php`
- Modify: `apps/backend/app/Providers/AppServiceProvider.php` (bind interface → implementation)

**Interfaces:**
- Consumes: `BusinessResourceRepositoryInterface` from Task 3
- Produces: Eloquent-backed implementation; DI binding in service provider

- [ ] **Step 1: Write Eloquent model**

```php
// apps/backend/app/Infrastructure/Persistence/Models/BusinessResourceModel.php
<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BusinessResourceModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'business_resources';

    protected $fillable = [
        'tenant_id', 'name', 'description', 'employee_id',
        'type', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function employee()
    {
        return $this->belongsTo(UserModel::class, 'employee_id');
    }
}
```

- [ ] **Step 2: Write repository implementation**

```php
// apps/backend/app/Infrastructure/Persistence/Repositories/EloquentBusinessResourceRepository.php
<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;

class EloquentBusinessResourceRepository implements BusinessResourceRepositoryInterface
{
    public function allForTenant(string $tenantId): array
    {
        return BusinessResourceModel::where('tenant_id', $tenantId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn ($m) => $this->toEntity($m))
            ->all();
    }

    public function findById(string $id): ?BusinessResource
    {
        $model = BusinessResourceModel::find($id);
        return $model ? $this->toEntity($model) : null;
    }

    public function save(BusinessResource $resource): BusinessResource
    {
        $model = BusinessResourceModel::updateOrCreate(
            ['id' => $resource->id],
            [
                'tenant_id'   => $resource->tenantId,
                'name'        => $resource->name,
                'description' => $resource->description,
                'employee_id' => $resource->employeeId,
                'type'        => $resource->type,
                'is_active'   => $resource->isActive,
                'sort_order'  => $resource->sortOrder,
            ]
        );
        return $this->toEntity($model->fresh());
    }

    public function delete(string $id): void
    {
        BusinessResourceModel::destroy($id);
    }

    private function toEntity(BusinessResourceModel $m): BusinessResource
    {
        return new BusinessResource(
            id: $m->id,
            tenantId: $m->tenant_id,
            name: $m->name,
            description: $m->description,
            employeeId: $m->employee_id,
            type: $m->type,
            isActive: $m->is_active,
            sortOrder: $m->sort_order,
        );
    }
}
```

- [ ] **Step 3: Bind interface in AppServiceProvider**

Open `apps/backend/app/Providers/AppServiceProvider.php`. In `register()`, add:

```php
$this->app->bind(
    \App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface::class,
    \App\Infrastructure\Persistence\Repositories\EloquentBusinessResourceRepository::class,
);
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/backend && ./vendor/bin/pest tests/Feature/BusinessResource/BusinessResourceCrudTest.php -v
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Infrastructure/Persistence/Models/BusinessResourceModel.php \
        app/Infrastructure/Persistence/Repositories/EloquentBusinessResourceRepository.php \
        app/Providers/AppServiceProvider.php
git commit -m "feat(backend): Eloquent business resource repository + DI binding"
```

---

### Task 5: Use cases + HTTP controller + routes

Adds CRUD use cases, a controller, and REST routes under the tenant auth group.

**Files:**
- Create: `apps/backend/app/Application/UseCases/BusinessResource/ListBusinessResourcesUseCase.php`
- Create: `apps/backend/app/Application/UseCases/BusinessResource/CreateBusinessResourceUseCase.php`
- Create: `apps/backend/app/Application/UseCases/BusinessResource/UpdateBusinessResourceUseCase.php`
- Create: `apps/backend/app/Application/UseCases/BusinessResource/DeleteBusinessResourceUseCase.php`
- Create: `apps/backend/app/Application/DTOs/BusinessResource/BusinessResourceDTO.php`
- Create: `apps/backend/app/Infrastructure/Http/Controllers/BusinessResource/BusinessResourceController.php`
- Create: `apps/backend/app/Infrastructure/Http/Resources/BusinessResourceResource.php`
- Modify: `apps/backend/routes/api.php`

**Interfaces:**
- Consumes: `BusinessResourceRepositoryInterface` from Task 3
- Produces: REST API at `/business-resources` (index, store, update, destroy) under tenant auth

- [ ] **Step 1: Write DTO**

```php
// apps/backend/app/Application/DTOs/BusinessResource/BusinessResourceDTO.php
<?php

namespace App\Application\DTOs\BusinessResource;

final readonly class BusinessResourceDTO
{
    public function __construct(
        public string $name,
        public ?string $description,
        public ?string $employeeId,
        public string $type,
        public bool $isActive,
        public int $sortOrder,
    ) {}
}
```

- [ ] **Step 2: Write use cases**

```php
// apps/backend/app/Application/UseCases/BusinessResource/ListBusinessResourcesUseCase.php
<?php

namespace App\Application\UseCases\BusinessResource;

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;

class ListBusinessResourcesUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $tenantId): array
    {
        return $this->repo->allForTenant($tenantId);
    }
}
```

```php
// apps/backend/app/Application/UseCases/BusinessResource/CreateBusinessResourceUseCase.php
<?php

namespace App\Application\UseCases\BusinessResource;

use App\Application\DTOs\BusinessResource\BusinessResourceDTO;
use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use Illuminate\Support\Str;

class CreateBusinessResourceUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $tenantId, BusinessResourceDTO $dto): BusinessResource
    {
        $resource = new BusinessResource(
            id: (string) Str::uuid(),
            tenantId: $tenantId,
            name: $dto->name,
            description: $dto->description,
            employeeId: $dto->employeeId,
            type: $dto->type,
            isActive: $dto->isActive,
            sortOrder: $dto->sortOrder,
        );
        return $this->repo->save($resource);
    }
}
```

```php
// apps/backend/app/Application/UseCases/BusinessResource/UpdateBusinessResourceUseCase.php
<?php

namespace App\Application\UseCases\BusinessResource;

use App\Application\DTOs\BusinessResource\BusinessResourceDTO;
use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateBusinessResourceUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $id, BusinessResourceDTO $dto): BusinessResource
    {
        $existing = $this->repo->findById($id);
        if (!$existing) {
            throw new HttpResponseException(response()->json(['message' => 'Resource not found'], 404));
        }

        $updated = new BusinessResource(
            id: $existing->id,
            tenantId: $existing->tenantId,
            name: $dto->name,
            description: $dto->description,
            employeeId: $dto->employeeId,
            type: $dto->type,
            isActive: $dto->isActive,
            sortOrder: $dto->sortOrder,
        );
        return $this->repo->save($updated);
    }
}
```

```php
// apps/backend/app/Application/UseCases/BusinessResource/DeleteBusinessResourceUseCase.php
<?php

namespace App\Application\UseCases\BusinessResource;

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;

class DeleteBusinessResourceUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $id): void
    {
        $this->repo->delete($id);
    }
}
```

- [ ] **Step 3: Write API resource (JSON transformer)**

```php
// apps/backend/app/Infrastructure/Http/Resources/BusinessResourceResource.php
<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class BusinessResourceResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'          => $this->id,
            'tenant_id'   => $this->tenant_id,
            'name'        => $this->name,
            'description' => $this->description,
            'employee_id' => $this->employee_id,
            'type'        => $this->type,
            'is_active'   => $this->is_active,
            'sort_order'  => $this->sort_order,
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
```

- [ ] **Step 4: Write controller**

```php
// apps/backend/app/Infrastructure/Http/Controllers/BusinessResource/BusinessResourceController.php
<?php

namespace App\Infrastructure\Http\Controllers\BusinessResource;

use App\Application\DTOs\BusinessResource\BusinessResourceDTO;
use App\Application\UseCases\BusinessResource\CreateBusinessResourceUseCase;
use App\Application\UseCases\BusinessResource\DeleteBusinessResourceUseCase;
use App\Application\UseCases\BusinessResource\ListBusinessResourcesUseCase;
use App\Application\UseCases\BusinessResource\UpdateBusinessResourceUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\BusinessResourceResource;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessResourceController extends Controller
{
    public function __construct(
        private ListBusinessResourcesUseCase $list,
        private CreateBusinessResourceUseCase $create,
        private UpdateBusinessResourceUseCase $update,
        private DeleteBusinessResourceUseCase $delete,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->currentTenant()->id;
        $resources = $this->list->execute($tenantId);
        return response()->json(['data' => array_map(
            fn ($r) => BusinessResourceModel::find($r->id),
            $resources
        )])->setContent(
            BusinessResourceResource::collection(
                BusinessResourceModel::where('tenant_id', $tenantId)
                    ->orderBy('sort_order')->orderBy('name')->get()
            )->response()->getContent()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'employee_id' => 'nullable|uuid|exists:users,id',
            'type'        => 'sometimes|in:physical,person',
            'is_active'   => 'sometimes|boolean',
            'sort_order'  => 'sometimes|integer|min:0',
        ]);

        $tenantId = $request->user()->currentTenant()->id;
        $dto = new BusinessResourceDTO(
            name: $data['name'],
            description: $data['description'] ?? null,
            employeeId: $data['employee_id'] ?? null,
            type: $data['type'] ?? 'physical',
            isActive: $data['is_active'] ?? true,
            sortOrder: $data['sort_order'] ?? 0,
        );

        $resource = $this->create->execute($tenantId, $dto);
        return response()->json(
            ['data' => new BusinessResourceResource(BusinessResourceModel::find($resource->id))],
            201
        );
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'employee_id' => 'nullable|uuid|exists:users,id',
            'type'        => 'sometimes|in:physical,person',
            'is_active'   => 'sometimes|boolean',
            'sort_order'  => 'sometimes|integer|min:0',
        ]);

        $existing = BusinessResourceModel::findOrFail($id);
        $dto = new BusinessResourceDTO(
            name: $data['name'] ?? $existing->name,
            description: array_key_exists('description', $data) ? $data['description'] : $existing->description,
            employeeId: array_key_exists('employee_id', $data) ? $data['employee_id'] : $existing->employee_id,
            type: $data['type'] ?? $existing->type,
            isActive: $data['is_active'] ?? $existing->is_active,
            sortOrder: $data['sort_order'] ?? $existing->sort_order,
        );

        $resource = $this->update->execute($id, $dto);
        return response()->json(
            ['data' => new BusinessResourceResource(BusinessResourceModel::find($resource->id))]
        );
    }

    public function destroy(string $id): JsonResponse
    {
        $this->delete->execute($id);
        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Register routes**

Open `apps/backend/routes/api.php`. Inside the authenticated tenant route group (after the `client-resources` block), add:

```php
// Business Resources (stations, chairs, rooms)
Route::get('business-resources', [BusinessResourceController::class, 'index']);
Route::post('business-resources', [BusinessResourceController::class, 'store']);
Route::patch('business-resources/{id}', [BusinessResourceController::class, 'update']);
Route::delete('business-resources/{id}', [BusinessResourceController::class, 'destroy']);
```

Add the import at the top of the file with the other controller imports:
```php
use App\Infrastructure\Http\Controllers\BusinessResource\BusinessResourceController;
```

- [ ] **Step 6: Write HTTP feature test**

```php
// apps/backend/tests/Feature/BusinessResource/BusinessResourceApiTest.php
<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('owner can list business resources', function () {
    $tenant = TenantModel::factory()->create();
    $owner = UserModel::factory()->create(['role' => 'owner']);
    $owner->tenants()->attach($tenant->id);

    \App\Infrastructure\Persistence\Models\BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $tenant->id,
        'name' => 'Estación 1',
        'type' => 'physical',
        'is_active' => true,
        'sort_order' => 0,
    ]);

    $this->actingAs($owner)
        ->getJson('/api/business-resources')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('owner can create a business resource', function () {
    $tenant = TenantModel::factory()->create();
    $owner = UserModel::factory()->create(['role' => 'owner']);
    $owner->tenants()->attach($tenant->id);

    $this->actingAs($owner)
        ->postJson('/api/business-resources', [
            'name' => 'Silla Juan',
            'type' => 'person',
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Silla Juan')
        ->assertJsonPath('data.type', 'person');
});

it('owner can delete a business resource', function () {
    $tenant = TenantModel::factory()->create();
    $owner = UserModel::factory()->create(['role' => 'owner']);
    $owner->tenants()->attach($tenant->id);

    $id = (string) \Illuminate\Support\Str::uuid();
    \App\Infrastructure\Persistence\Models\BusinessResourceModel::create([
        'id' => $id,
        'tenant_id' => $tenant->id,
        'name' => 'Sala 1',
        'type' => 'physical',
        'is_active' => true,
        'sort_order' => 0,
    ]);

    $this->actingAs($owner)
        ->deleteJson("/api/business-resources/{$id}")
        ->assertNoContent();

    expect(\App\Infrastructure\Persistence\Models\BusinessResourceModel::find($id))->toBeNull();
});
```

- [ ] **Step 7: Run full test suite**

```bash
cd apps/backend && composer test
```
Expected: all pass (adjust factory/auth helpers to match actual test setup patterns in the project).

- [ ] **Step 8: Commit**

```bash
git add app/Application/DTOs/BusinessResource/ \
        app/Application/UseCases/BusinessResource/ \
        app/Infrastructure/Http/Controllers/BusinessResource/ \
        app/Infrastructure/Http/Resources/BusinessResourceResource.php \
        routes/api.php \
        tests/Feature/BusinessResource/BusinessResourceApiTest.php
git commit -m "feat(backend): business resources CRUD use cases, controller, routes"
```

---

## Phase 3 — Business Resources Frontend

### Task 6: Domain entity + repository + use cases

Mirrors the backend `BusinessResource` entity in the frontend and adds the API repository.

**Files:**
- Create: `apps/admin-v2/src/domain/entities/business-resource.ts`
- Create: `apps/admin-v2/src/domain/repositories/business-resource.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-business-resource.repository.ts`
- Create: `apps/admin-v2/src/application/use-cases/business-resources/list-business-resources.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/business-resources/create-business-resource.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/business-resources/update-business-resource.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/business-resources/delete-business-resource.use-case.ts`
- Modify: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx` (register new repo)

**Interfaces:**
- Produces: `useRepository('businessResource')` returns a `BusinessResourceRepository`

- [ ] **Step 1: Domain entity**

```typescript
// apps/admin-v2/src/domain/entities/business-resource.ts
export type ResourceType = 'physical' | 'person';

export interface BusinessResource {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  employeeId: string | null;
  type: ResourceType;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessResourceInput {
  name: string;
  description?: string | null;
  employeeId?: string | null;
  type?: ResourceType;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateBusinessResourceInput extends Partial<CreateBusinessResourceInput> {}
```

- [ ] **Step 2: Repository interface**

```typescript
// apps/admin-v2/src/domain/repositories/business-resource.repository.ts
import type { BusinessResource, CreateBusinessResourceInput, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';

export interface BusinessResourceRepository {
  list(): Promise<BusinessResource[]>;
  create(input: CreateBusinessResourceInput): Promise<BusinessResource>;
  update(id: string, input: UpdateBusinessResourceInput): Promise<BusinessResource>;
  remove(id: string): Promise<void>;
}
```

- [ ] **Step 3: API repository**

```typescript
// apps/admin-v2/src/infrastructure/api/repositories/api-business-resource.repository.ts
import api from '@/infrastructure/api/client';
import type { BusinessResource, CreateBusinessResourceInput, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';

function mapResource(raw: Record<string, unknown>): BusinessResource {
  return {
    id: raw.id as string,
    tenantId: raw.tenant_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    employeeId: (raw.employee_id as string | null) ?? null,
    type: raw.type as 'physical' | 'person',
    isActive: raw.is_active as boolean,
    sortOrder: raw.sort_order as number,
    createdAt: new Date(raw.created_at as string),
    updatedAt: new Date(raw.updated_at as string),
  };
}

export class ApiBusinessResourceRepository implements BusinessResourceRepository {
  async list(): Promise<BusinessResource[]> {
    const { data: res } = await api.get<{ data: Record<string, unknown>[] }>('/business-resources');
    return res.data.map(mapResource);
  }

  async create(input: CreateBusinessResourceInput): Promise<BusinessResource> {
    const { data: res } = await api.post<{ data: Record<string, unknown> }>('/business-resources', {
      name: input.name,
      description: input.description ?? null,
      employee_id: input.employeeId ?? null,
      type: input.type ?? 'physical',
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    });
    return mapResource(res.data);
  }

  async update(id: string, input: UpdateBusinessResourceInput): Promise<BusinessResource> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.employeeId !== undefined) payload.employee_id = input.employeeId;
    if (input.type !== undefined) payload.type = input.type;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

    const { data: res } = await api.patch<{ data: Record<string, unknown> }>(`/business-resources/${id}`, payload);
    return mapResource(res.data);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/business-resources/${id}`);
  }
}
```

- [ ] **Step 4: Use cases**

```typescript
// apps/admin-v2/src/application/use-cases/business-resources/list-business-resources.use-case.ts
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { BusinessResource } from '@/domain/entities/business-resource';

export class ListBusinessResourcesUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(): Promise<BusinessResource[]> {
    return this.repo.list();
  }
}
```

```typescript
// apps/admin-v2/src/application/use-cases/business-resources/create-business-resource.use-case.ts
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { BusinessResource, CreateBusinessResourceInput } from '@/domain/entities/business-resource';

export class CreateBusinessResourceUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(input: CreateBusinessResourceInput): Promise<BusinessResource> {
    return this.repo.create(input);
  }
}
```

```typescript
// apps/admin-v2/src/application/use-cases/business-resources/update-business-resource.use-case.ts
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { BusinessResource, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';

export class UpdateBusinessResourceUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(id: string, input: UpdateBusinessResourceInput): Promise<BusinessResource> {
    return this.repo.update(id, input);
  }
}
```

```typescript
// apps/admin-v2/src/application/use-cases/business-resources/delete-business-resource.use-case.ts
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';

export class DeleteBusinessResourceUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
```

- [ ] **Step 5: Register in repository provider**

Open `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`. Find the pattern where other repositories (e.g., `tenant`) are registered and add `businessResource` using the same pattern:

```typescript
import { ApiBusinessResourceRepository } from '@/infrastructure/api/repositories/api-business-resource.repository';
// In the repository map / factory:
businessResource: new ApiBusinessResourceRepository(),
```

The exact edit depends on whether the provider uses a map, context, or switch — follow the existing pattern.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-v2/src/domain/entities/business-resource.ts \
        apps/admin-v2/src/domain/repositories/business-resource.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-business-resource.repository.ts \
        apps/admin-v2/src/application/use-cases/business-resources/ \
        apps/admin-v2/src/infrastructure/providers/repository.provider.tsx
git commit -m "feat(admin): business resource domain entity, API repository, use cases"
```

---

### Task 7: React Query hooks + Resources settings UI

Adds `useBusinessResources` hook and a CRUD UI inside Settings where owners manage their stations/chairs/rooms.

**Files:**
- Create: `apps/admin-v2/src/presentation/hooks/use-business-resources.ts`
- Create: `apps/admin-v2/src/presentation/components/features/settings/resources-tab.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/settings/page.tsx` (add Resources tab)

**Interfaces:**
- Consumes: use cases from Task 6
- Produces: `useBusinessResources()`, `useCreateBusinessResource()`, `useUpdateBusinessResource()`, `useDeleteBusinessResource()`

- [ ] **Step 1: Write hooks**

```typescript
// apps/admin-v2/src/presentation/hooks/use-business-resources.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { ListBusinessResourcesUseCase } from '@/application/use-cases/business-resources/list-business-resources.use-case';
import { CreateBusinessResourceUseCase } from '@/application/use-cases/business-resources/create-business-resource.use-case';
import { UpdateBusinessResourceUseCase } from '@/application/use-cases/business-resources/update-business-resource.use-case';
import { DeleteBusinessResourceUseCase } from '@/application/use-cases/business-resources/delete-business-resource.use-case';
import type { CreateBusinessResourceInput, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';

export function useBusinessResources() {
  const repo = useRepository('businessResource');
  return useQuery({
    queryKey: ['business-resources'],
    queryFn: () => new ListBusinessResourcesUseCase(repo).execute(),
  });
}

export function useCreateBusinessResource() {
  const repo = useRepository('businessResource');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBusinessResourceInput) =>
      new CreateBusinessResourceUseCase(repo).execute(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-resources'] }),
  });
}

export function useUpdateBusinessResource() {
  const repo = useRepository('businessResource');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBusinessResourceInput }) =>
      new UpdateBusinessResourceUseCase(repo).execute(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-resources'] }),
  });
}

export function useDeleteBusinessResource() {
  const repo = useRepository('businessResource');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new DeleteBusinessResourceUseCase(repo).execute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-resources'] }),
  });
}
```

- [ ] **Step 2: Write Resources settings tab**

```typescript
// apps/admin-v2/src/presentation/components/features/settings/resources-tab.tsx
'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  useBusinessResources,
  useCreateBusinessResource,
  useUpdateBusinessResource,
  useDeleteBusinessResource,
} from '@/presentation/hooks/use-business-resources';
import type { BusinessResource, ResourceType } from '@/domain/entities/business-resource';

interface ResourceFormState {
  name: string;
  description: string;
  type: ResourceType;
  isActive: boolean;
}

const EMPTY_FORM: ResourceFormState = {
  name: '',
  description: '',
  type: 'physical',
  isActive: true,
};

export function ResourcesTab() {
  const { data: resources, isLoading } = useBusinessResources();
  const createMutation = useCreateBusinessResource();
  const updateMutation = useUpdateBusinessResource();
  const deleteMutation = useDeleteBusinessResource();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessResource | null>(null);
  const [form, setForm] = useState<ResourceFormState>(EMPTY_FORM);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(resource: BusinessResource) {
    setEditing(resource);
    setForm({
      name: resource.name,
      description: resource.description ?? '',
      type: resource.type,
      isActive: resource.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          type: form.type,
          isActive: form.isActive,
        }});
        toast.success('Recurso actualizado');
      } else {
        await createMutation.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || null,
          type: form.type,
          isActive: form.isActive,
        });
        toast.success('Recurso creado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Error al guardar recurso');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Recurso eliminado');
    } catch {
      toast.error('Error al eliminar recurso');
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-[15px] font-semibold">Recursos</CardTitle>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              Estaciones, sillas, salas — los espacios o personas que se pueden reservar.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!resources?.length ? (
            <div className="px-6 py-8 text-center text-sm text-[var(--fg-muted)]">
              Sin recursos. Agrega estaciones, sillas o salas.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-[var(--fg-muted)] truncate">{r.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[11px] shrink-0">
                    {r.type === 'physical' ? 'Físico' : 'Persona'}
                  </Badge>
                  {!r.isActive && (
                    <Badge variant="secondary" className="text-[11px] shrink-0">Inactivo</Badge>
                  )}
                  <button
                    onClick={() => openEdit(r)}
                    className="p-1.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded text-[var(--fg-muted)] hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar recurso' : 'Nuevo recurso'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                className="mt-1"
                placeholder="Estación 1, Silla Juan, Sala masaje..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input
                className="mt-1"
                placeholder="Notas internas sobre este recurso"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <div className="flex gap-2 mt-1">
                {(['physical', 'person'] as ResourceType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      form.type === t
                        ? 'bg-[var(--brand-50)] border-[var(--brand-200)] text-[var(--brand-700)] font-medium'
                        : 'border-[var(--border-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {t === 'physical' ? 'Físico' : 'Persona'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Add Resources tab to Settings page**

Open `apps/admin-v2/src/presentation/app/(tenant)/settings/page.tsx`. Find where existing tabs (Permisos, etc.) are defined and add a "Recursos" tab entry following the same pattern. Import `ResourcesTab` and render it in the tab panel.

- [ ] **Step 4: Manual smoke test**

1. Start dev server: `cd apps/admin-v2 && npm run dev`
2. Go to Settings → find the Recursos tab
3. Create a resource "Estación 1" (type: Físico)
4. Verify it appears in the list
5. Edit it, change name → verify update persists
6. Delete it → verify it disappears

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/presentation/hooks/use-business-resources.ts \
        apps/admin-v2/src/presentation/components/features/settings/resources-tab.tsx \
        apps/admin-v2/src/presentation/app/(tenant)/settings/page.tsx
git commit -m "feat(admin): business resources CRUD UI in settings"
```

---

## Phase 4 — Employee-as-Resource + Tenant Config

### Task 8: Link resource to employee + tenant setting

Adds `allow_client_resource_selection` to `TenantSettings` so barbershops/spas can let clients choose their preferred barber/therapist. Also enables linking a `BusinessResource` to an employee.

**Files:**
- Modify: `apps/admin-v2/src/domain/entities/tenant.ts`
- Modify: `apps/admin-v2/src/presentation/components/features/settings/resources-tab.tsx`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php` (add field to accepted inputs)

**Interfaces:**
- Consumes: `TenantSettings.allowClientResourceSelection: boolean` (new field)
- Produces: When true, public booking flow shows resource selector step

- [ ] **Step 1: Add field to TenantSettings entity**

Open `apps/admin-v2/src/domain/entities/tenant.ts`. Add to `TenantSettings` interface after `autoConfirmReservations`:

```typescript
/** When true, clients can choose a preferred resource (e.g. barber, therapist)
    during public booking. Auto-assigns when false. */
allowClientResourceSelection: boolean;
```

- [ ] **Step 2: Expose field in settings mapper**

Find where the backend `/settings` response is mapped to `TenantSettings` in `apps/admin-v2/src/infrastructure/api/repositories/`. Add `allowClientResourceSelection: raw.allow_client_resource_selection ?? false` to the mapper.

- [ ] **Step 3: Add toggle in settings UI**

In the general settings tab (where `autoConfirmReservations` toggle lives — find it by searching for `autoConfirmReservations` in the settings components), add a similar toggle:

```typescript
// Pattern to follow — matches existing boolean setting toggles
{
  key: 'allowClientResourceSelection',
  label: 'Permitir elegir recurso al reservar',
  description: 'Clientes pueden elegir barbero, terapeuta o sala al hacer una reserva.',
}
```

- [ ] **Step 4: Add employee picker in ResourcesTab**

In `resources-tab.tsx`, when `type === 'person'`, show an employee selector in the create/edit form. This requires also loading the team list:

```typescript
// Add to the form, shown only when type === 'person':
import { useTeam } from '@/presentation/hooks/use-team'; // check exact hook name

// In form JSX, after the type selector:
{form.type === 'person' && (
  <div>
    <label className="text-sm font-medium">Empleado vinculado (opcional)</label>
    <select
      className="mt-1 w-full rounded-md border border-[var(--border-soft)] px-3 py-2 text-sm"
      value={form.employeeId ?? ''}
      onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value || null }))}
    >
      <option value="">Sin vincular</option>
      {team?.map((member) => (
        <option key={member.id} value={member.id}>{member.name}</option>
      ))}
    </select>
  </div>
)}
```

Also add `employeeId: string | null` to `ResourceFormState` and update `EMPTY_FORM` accordingly.

- [ ] **Step 5: Persist employeeId in save calls**

In `handleSubmit` in `resources-tab.tsx`, include `employeeId: form.employeeId` in both create and update mutation inputs.

- [ ] **Step 6: Backend — accept `allow_client_resource_selection` in settings update**

Open `apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php`. In the `update` method's validation rules, add:

```php
'allow_client_resource_selection' => 'sometimes|boolean',
```

And persist it to the tenant settings record following the same pattern as other boolean settings.

- [ ] **Step 7: Manual smoke test — barbershop flow**

1. Set business type to `barbershop` in settings.
2. Go to Settings → Recursos → create "Silla Juan" (type: Persona, employee: Juan).
3. Enable "Permitir elegir recurso al reservar".
4. Open the public booking link for the tenant.
5. Verify a "¿Con quién?" step appears showing "Silla Juan".

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/src/domain/entities/tenant.ts \
        apps/admin-v2/src/presentation/components/features/settings/resources-tab.tsx \
        apps/admin-v2/src/infrastructure/api/repositories/api-tenant.repository.ts \
        apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php
git commit -m "feat: allow_client_resource_selection setting + employee-linked resource support"
```

---

## Self-Review

### Spec coverage
- [x] Sidebar filters nav by role via permissions matrix
- [x] `owner`/`tenant_admin` always see everything
- [x] `washer`/`cashier` see only matrix-allowed sections
- [x] Sections not in matrix (Inventario, Mi Plan) hidden from restricted roles
- [x] Business resources backend (migration, domain, repo, use cases, controller, routes)
- [x] Business resources frontend (entity, repo, use cases, hooks, settings UI)
- [x] Employee-as-resource link (`employee_id` on `business_resources`)
- [x] Tenant config `allow_client_resource_selection`

### Placeholder scan
- Task 6 Step 5 (repository provider registration): intentionally vague because the provider pattern wasn't fully explored. Before executing, read the actual `repository.provider.tsx` to follow the exact registration pattern.
- Task 7 Step 3 (add to settings page): intentionally vague because the settings page tab structure wasn't read. Before executing, read `settings/page.tsx` and follow the existing tab pattern.
- Task 8 Step 2 (settings mapper): read the actual mapper file first.

### Type consistency
- `BusinessResource.employeeId` used consistently across entity, repository, DTO, mapper.
- `ResourceType = 'physical' | 'person'` used in entity and forms.
- `ROLE_TO_MATRIX` uses `UserRole` keys consistently with `user.ts:1`.
