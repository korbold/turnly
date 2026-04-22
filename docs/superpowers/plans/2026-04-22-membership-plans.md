# Membership Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a plan/membership system with full CRUD from SuperAdmin, limits enforcement per plan, and trial auto-suspension.

**Architecture:** New `plans` table with configurable limits. Tenants get a `plan_id` FK replacing the old `plan` enum. A `PlanLimitsService` injects into existing controllers to enforce limits. SuperAdmin gets a new Plans page for CRUD + assign plan to tenants.

**Tech Stack:** Laravel (backend), Next.js + React Query + shadcn/ui (admin frontend)

**Spec:** `docs/superpowers/specs/2026-04-22-membership-plans-design.md`

---

## File Map

### Backend — New Files
| File | Purpose |
|------|---------|
| `database/migrations/XXXX_create_plans_table.php` | Plans table schema |
| `database/migrations/XXXX_replace_plan_enum_with_plan_id_on_tenants.php` | Tenant migration |
| `database/seeders/PlanSeeder.php` | 4 default plans |
| `app/Domain/Plan/Entities/Plan.php` | Plan domain entity |
| `app/Domain/Plan/Contracts/PlanRepositoryInterface.php` | Repository interface |
| `app/Infrastructure/Persistence/Models/PlanModel.php` | Eloquent model |
| `app/Infrastructure/Persistence/Repositories/EloquentPlanRepository.php` | Repository impl |
| `app/Infrastructure/Http/Controllers/SuperAdmin/PlanController.php` | CRUD controller |
| `app/Infrastructure/Http/Resources/PlanResource.php` | API resource |
| `app/Application/Services/PlanLimitsService.php` | Enforcement logic |
| `app/Infrastructure/Console/Commands/CheckExpiredTrialsCommand.php` | Artisan command |

### Backend — Modified Files
| File | Change |
|------|--------|
| `routes/api.php:139-150` | Add plan routes + assign-plan route |
| `routes/console.php:11` | Add trial check schedule |
| `app/Infrastructure/Providers/RepositoryServiceProvider.php:19-26` | Bind PlanRepository |
| `app/Domain/Tenant/Entities/Tenant.php:7-22` | Replace `plan` with `planId` + `isTrial` |
| `app/Infrastructure/Persistence/Models/TenantModel.php:16-22` | Update fillable, add relationship |
| `app/Infrastructure/Persistence/Repositories/EloquentTenantRepository.php:42-113` | Update save() + mapToEntity() |
| `app/Infrastructure/Http/Resources/TenantResource.php:21` | Replace plan with plan relation |
| `app/Infrastructure/Http/Controllers/Service/ServiceController.php:23-28` | Add limit check |
| `app/Infrastructure/Http/Controllers/Reservation/ReservationController.php:100-113` | Add limit check |
| `app/Infrastructure/Http/Controllers/User/UserController.php:41-84` | Add employee limit check |
| `app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php` | Add assignPlan method |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `src/domain/entities/plan.ts` | Plan TypeScript interface |
| `src/infrastructure/api/mappers/plan.mapper.ts` | API → domain mapper |
| `src/presentation/hooks/use-plans.ts` | CRUD hooks |
| `src/presentation/app/(super-admin)/plans/page.tsx` | Plans CRUD page |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `src/domain/entities/tenant.ts:1` | Update TenantPlan type → plan object |
| `src/domain/repositories/super-admin.repository.ts:13-19` | Add plan + assignPlan methods |
| `src/infrastructure/api/repositories/api-super-admin.repository.ts` | Add plan + assignPlan impls |
| `src/infrastructure/api/mappers/tenant.mapper.ts:14` | Map plan object |
| `src/presentation/hooks/use-super-admin.ts` | Add assignPlan hook |
| `src/presentation/app/(super-admin)/layout.tsx:11-16` | Add Plans nav item |
| `src/presentation/app/(super-admin)/tenants/page.tsx:192-194` | Plan badge + assign dropdown |

---

## Task 1: Plans migration + model + seeder

**Files:**
- Create: `apps/backend/database/migrations/2026_04_22_200000_create_plans_table.php`
- Create: `apps/backend/database/seeders/PlanSeeder.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/PlanModel.php`

- [ ] **Step 1: Create plans migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->decimal('price', 8, 2)->default(0);
            $table->unsignedInteger('max_services')->nullable();
            $table->unsignedInteger('max_reservations_per_month')->nullable();
            $table->unsignedInteger('max_employees')->nullable();
            $table->boolean('has_push_notifications')->default(false);
            $table->boolean('has_reports')->default(false);
            $table->boolean('has_reminders')->default(false);
            $table->boolean('has_custom_page')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
```

- [ ] **Step 2: Create PlanModel**

```php
<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlanModel extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'plans';

    protected $fillable = [
        'name', 'slug', 'price',
        'max_services', 'max_reservations_per_month', 'max_employees',
        'has_push_notifications', 'has_reports', 'has_reminders', 'has_custom_page',
        'is_active', 'sort_order', 'description',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'max_services' => 'integer',
            'max_reservations_per_month' => 'integer',
            'max_employees' => 'integer',
            'has_push_notifications' => 'boolean',
            'has_reports' => 'boolean',
            'has_reminders' => 'boolean',
            'has_custom_page' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function tenants()
    {
        return $this->hasMany(TenantModel::class, 'plan_id');
    }
}
```

- [ ] **Step 3: Create PlanSeeder**

```php
<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\PlanModel;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Gratis',
                'slug' => 'free',
                'price' => 0,
                'max_services' => 1,
                'max_reservations_per_month' => 30,
                'max_employees' => 0,
                'has_push_notifications' => false,
                'has_reports' => false,
                'has_reminders' => false,
                'has_custom_page' => false,
                'sort_order' => 1,
                'description' => 'Para empezar. 1 servicio, 30 reservas/mes.',
            ],
            [
                'name' => 'Básico',
                'slug' => 'basic',
                'price' => 9.99,
                'max_services' => 5,
                'max_reservations_per_month' => null,
                'max_employees' => 1,
                'has_push_notifications' => true,
                'has_reports' => false,
                'has_reminders' => false,
                'has_custom_page' => false,
                'sort_order' => 2,
                'description' => '5 servicios, reservas ilimitadas, 1 empleado.',
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'price' => 19.99,
                'max_services' => null,
                'max_reservations_per_month' => null,
                'max_employees' => null,
                'has_push_notifications' => true,
                'has_reports' => true,
                'has_reminders' => true,
                'has_custom_page' => false,
                'sort_order' => 3,
                'description' => 'Todo ilimitado, reportes y recordatorios.',
            ],
            [
                'name' => 'Premium',
                'slug' => 'premium',
                'price' => 29.99,
                'max_services' => null,
                'max_reservations_per_month' => null,
                'max_employees' => null,
                'has_push_notifications' => true,
                'has_reports' => true,
                'has_reminders' => true,
                'has_custom_page' => true,
                'sort_order' => 4,
                'description' => 'Todo + página pública personalizada, soporte prioritario.',
            ],
        ];

        foreach ($plans as $plan) {
            PlanModel::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
```

- [ ] **Step 4: Run migration + seeder**

```bash
cd apps/backend && php artisan migrate && php artisan db:seed --class=PlanSeeder
```

Expected: Migration creates `plans` table, seeder inserts 4 plans.

- [ ] **Step 5: Verify**

```bash
cd apps/backend && php artisan tinker --execute="echo App\Infrastructure\Persistence\Models\PlanModel::count();"
```

Expected: `4`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/database/migrations/*create_plans_table* apps/backend/database/seeders/PlanSeeder.php apps/backend/app/Infrastructure/Persistence/Models/PlanModel.php
git commit -m "feat(plans): add plans table, model, and seeder with 4 default plans"
```

---

## Task 2: Tenant migration — replace plan enum with plan_id FK

**Files:**
- Create: `apps/backend/database/migrations/2026_04_22_200100_replace_plan_enum_with_plan_id_on_tenants.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/TenantModel.php`

- [ ] **Step 1: Create tenant migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Add new columns
        Schema::table('tenants', function (Blueprint $table) {
            $table->uuid('plan_id')->nullable()->after('country');
            $table->boolean('is_trial')->default(false)->after('plan_id');
            $table->foreign('plan_id')->references('id')->on('plans')->nullOnDelete();
        });

        // Step 2: Migrate data
        $planMap = DB::table('plans')->pluck('id', 'slug');

        // trial → is_trial=true, plan_id=null
        DB::table('tenants')->where('plan', 'trial')->update([
            'is_trial' => true,
            'plan_id' => null,
        ]);

        // basic → plan_id=basic UUID
        if ($planMap->has('basic')) {
            DB::table('tenants')->where('plan', 'basic')->update([
                'is_trial' => false,
                'plan_id' => $planMap['basic'],
            ]);
        }

        // pro → plan_id=pro UUID
        if ($planMap->has('pro')) {
            DB::table('tenants')->where('plan', 'pro')->update([
                'is_trial' => false,
                'plan_id' => $planMap['pro'],
            ]);
        }

        // Step 3: Drop old column
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('plan');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('plan')->default('trial')->after('country');
        });

        $planMap = DB::table('plans')->pluck('slug', 'id');

        DB::table('tenants')->where('is_trial', true)->update(['plan' => 'trial']);

        foreach ($planMap as $planId => $slug) {
            DB::table('tenants')->where('plan_id', $planId)->update(['plan' => $slug]);
        }

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropForeign(['plan_id']);
            $table->dropColumn(['plan_id', 'is_trial']);
        });
    }
};
```

- [ ] **Step 2: Update TenantModel fillable + add relationship**

In `apps/backend/app/Infrastructure/Persistence/Models/TenantModel.php`:

Replace the `$fillable` array:
```php
    protected $fillable = [
        'slug', 'name', 'owner_name', 'email', 'phone',
        'city', 'country', 'plan_id', 'is_trial', 'status',
        'trial_ends_at', 'settings', 'onboarding_step', 'activated_at',
        'business_type', 'custom_fields', 'description', 'address',
        'logo_url', 'cover_url', 'social_links', 'brand_theme',
    ];
```

Add to `casts()`:
```php
    'is_trial' => 'boolean',
```

Add relationship method after `images()`:
```php
    public function plan()
    {
        return $this->belongsTo(PlanModel::class, 'plan_id');
    }
```

- [ ] **Step 3: Run migration**

```bash
cd apps/backend && php artisan migrate
```

Expected: Adds `plan_id`, `is_trial` to tenants, migrates data, drops `plan` column.

- [ ] **Step 4: Verify**

```bash
cd apps/backend && php artisan tinker --execute="echo json_encode(App\Infrastructure\Persistence\Models\TenantModel::first()?->only('plan_id','is_trial'));"
```

Expected: JSON showing plan_id (UUID or null) and is_trial (true/false).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/database/migrations/*replace_plan_enum* apps/backend/app/Infrastructure/Persistence/Models/TenantModel.php
git commit -m "feat(plans): migrate tenants from plan enum to plan_id FK"
```

---

## Task 3: Plan domain entity + repository

**Files:**
- Create: `apps/backend/app/Domain/Plan/Entities/Plan.php`
- Create: `apps/backend/app/Domain/Plan/Contracts/PlanRepositoryInterface.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentPlanRepository.php`
- Modify: `apps/backend/app/Infrastructure/Providers/RepositoryServiceProvider.php`

- [ ] **Step 1: Create Plan entity**

```php
<?php

namespace App\Domain\Plan\Entities;

final readonly class Plan
{
    public function __construct(
        public string $id,
        public string $name,
        public string $slug,
        public float $price,
        public ?int $maxServices,
        public ?int $maxReservationsPerMonth,
        public ?int $maxEmployees,
        public bool $hasPushNotifications,
        public bool $hasReports,
        public bool $hasReminders,
        public bool $hasCustomPage,
        public bool $isActive,
        public int $sortOrder,
        public ?string $description,
    ) {}
}
```

- [ ] **Step 2: Create PlanRepositoryInterface**

```php
<?php

namespace App\Domain\Plan\Contracts;

use App\Domain\Plan\Entities\Plan;

interface PlanRepositoryInterface
{
    public function findById(string $id): ?Plan;

    public function findBySlug(string $slug): ?Plan;

    public function all(): array;

    public function save(Plan $plan): Plan;

    public function delete(string $id): void;
}
```

- [ ] **Step 3: Create EloquentPlanRepository**

```php
<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Plan\Contracts\PlanRepositoryInterface;
use App\Domain\Plan\Entities\Plan;
use App\Infrastructure\Persistence\Models\PlanModel;
use Illuminate\Support\Str;

class EloquentPlanRepository implements PlanRepositoryInterface
{
    public function findById(string $id): ?Plan
    {
        $model = PlanModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findBySlug(string $slug): ?Plan
    {
        $model = PlanModel::where('slug', $slug)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function all(): array
    {
        return PlanModel::orderBy('sort_order')
            ->get()
            ->map(fn (PlanModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(Plan $plan): Plan
    {
        $model = PlanModel::find($plan->id);

        $data = [
            'name'                       => $plan->name,
            'slug'                       => $plan->slug,
            'price'                      => $plan->price,
            'max_services'               => $plan->maxServices,
            'max_reservations_per_month' => $plan->maxReservationsPerMonth,
            'max_employees'              => $plan->maxEmployees,
            'has_push_notifications'     => $plan->hasPushNotifications,
            'has_reports'                => $plan->hasReports,
            'has_reminders'              => $plan->hasReminders,
            'has_custom_page'            => $plan->hasCustomPage,
            'is_active'                  => $plan->isActive,
            'sort_order'                 => $plan->sortOrder,
            'description'                => $plan->description,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $plan->id ?: (string) Str::uuid();
            $model = PlanModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function delete(string $id): void
    {
        PlanModel::where('id', $id)->delete();
    }

    private function mapToEntity(PlanModel $model): Plan
    {
        return new Plan(
            id: $model->id,
            name: $model->name,
            slug: $model->slug,
            price: (float) $model->price,
            maxServices: $model->max_services,
            maxReservationsPerMonth: $model->max_reservations_per_month,
            maxEmployees: $model->max_employees,
            hasPushNotifications: $model->has_push_notifications,
            hasReports: $model->has_reports,
            hasReminders: $model->has_reminders,
            hasCustomPage: $model->has_custom_page,
            isActive: $model->is_active,
            sortOrder: $model->sort_order,
            description: $model->description,
        );
    }
}
```

- [ ] **Step 4: Register in RepositoryServiceProvider**

In `apps/backend/app/Infrastructure/Providers/RepositoryServiceProvider.php`, add import:
```php
use App\Domain\Plan\Contracts\PlanRepositoryInterface;
use App\Infrastructure\Persistence\Repositories\EloquentPlanRepository;
```

Add binding inside `register()`:
```php
        $this->app->bind(PlanRepositoryInterface::class, EloquentPlanRepository::class);
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Domain/Plan/ apps/backend/app/Infrastructure/Persistence/Repositories/EloquentPlanRepository.php apps/backend/app/Infrastructure/Providers/RepositoryServiceProvider.php
git commit -m "feat(plans): add Plan domain entity, repository interface, and Eloquent implementation"
```

---

## Task 4: Update Tenant entity + repository for plan_id

**Files:**
- Modify: `apps/backend/app/Domain/Tenant/Entities/Tenant.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentTenantRepository.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/TenantResource.php`

- [ ] **Step 1: Update Tenant entity**

Replace full file `apps/backend/app/Domain/Tenant/Entities/Tenant.php`:

```php
<?php

namespace App\Domain\Tenant\Entities;

final readonly class Tenant
{
    public function __construct(
        public string $id,
        public string $slug,
        public string $name,
        public string $ownerName,
        public string $email,
        public ?string $phone,
        public ?string $city,
        public string $country,
        public ?string $planId,
        public bool $isTrial,
        public string $status,
        public ?\DateTimeImmutable $trialEndsAt,
        public ?array $settings,
        public int $onboardingStep,
        public ?\DateTimeImmutable $activatedAt,
    ) {}

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    public function hasPlan(): bool
    {
        return $this->planId !== null;
    }

    public function isOnTrial(): bool
    {
        return $this->isTrial && !$this->isTrialExpired();
    }

    public function isTrialExpired(): bool
    {
        return $this->isTrial
            && $this->trialEndsAt !== null
            && $this->trialEndsAt < new \DateTimeImmutable();
    }
}
```

- [ ] **Step 2: Update EloquentTenantRepository**

In `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentTenantRepository.php`:

In `save()` method, replace `'plan' => $tenant->plan,` with:
```php
            'plan_id'          => $tenant->planId,
            'is_trial'         => $tenant->isTrial,
```

In `mapToEntity()`, replace `plan: $model->plan,` with:
```php
            planId: $model->plan_id,
            isTrial: (bool) $model->is_trial,
```

- [ ] **Step 3: Update TenantResource**

In `apps/backend/app/Infrastructure/Http/Resources/TenantResource.php`:

Replace `'plan' => $this->plan,` with:
```php
            'plan_id'         => $this->plan_id,
            'is_trial'        => (bool) $this->is_trial,
            'plan'            => $this->plan ? [
                'id'    => $this->plan->id,
                'name'  => $this->plan->name,
                'slug'  => $this->plan->slug,
                'price' => (float) $this->plan->price,
            ] : null,
```

- [ ] **Step 4: Update SuperAdminController index to eager-load plan**

In `apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php`, replace line 24:

```php
        $tenants = TenantModel::with('plan')
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));
```

- [ ] **Step 5: Test**

```bash
cd apps/backend && php artisan tinker --execute="echo json_encode(App\Infrastructure\Http\Resources\TenantResource::make(App\Infrastructure\Persistence\Models\TenantModel::with('plan')->first()));"
```

Expected: Tenant JSON with `plan` object (or null) and `plan_id`, `is_trial` fields.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Domain/Tenant/Entities/Tenant.php apps/backend/app/Infrastructure/Persistence/Repositories/EloquentTenantRepository.php apps/backend/app/Infrastructure/Http/Resources/TenantResource.php apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php
git commit -m "feat(plans): update Tenant entity, repository, and resource for plan_id FK"
```

---

## Task 5: Plan CRUD controller + routes + resource

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/PlanController.php`
- Create: `apps/backend/app/Infrastructure/Http/Resources/PlanResource.php`
- Modify: `apps/backend/routes/api.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php`

- [ ] **Step 1: Create PlanResource**

```php
<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                         => $this->id,
            'name'                       => $this->name,
            'slug'                       => $this->slug,
            'price'                      => (float) $this->price,
            'max_services'               => $this->max_services,
            'max_reservations_per_month' => $this->max_reservations_per_month,
            'max_employees'              => $this->max_employees,
            'has_push_notifications'     => (bool) $this->has_push_notifications,
            'has_reports'                => (bool) $this->has_reports,
            'has_reminders'              => (bool) $this->has_reminders,
            'has_custom_page'            => (bool) $this->has_custom_page,
            'is_active'                  => (bool) $this->is_active,
            'sort_order'                 => $this->sort_order,
            'description'                => $this->description,
            'tenants_count'              => $this->whenCounted('tenants'),
            'created_at'                 => $this->created_at?->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 2: Create PlanController**

```php
<?php

namespace App\Infrastructure\Http\Controllers\SuperAdmin;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\PlanResource;
use App\Infrastructure\Persistence\Models\PlanModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = PlanModel::withCount('tenants')->orderBy('sort_order')->get();

        return response()->json(['data' => PlanResource::collection($plans)]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'                       => 'required|string|max:100',
            'price'                      => 'required|numeric|min:0',
            'max_services'               => 'nullable|integer|min:0',
            'max_reservations_per_month' => 'nullable|integer|min:0',
            'max_employees'              => 'nullable|integer|min:0',
            'has_push_notifications'     => 'boolean',
            'has_reports'                => 'boolean',
            'has_reminders'              => 'boolean',
            'has_custom_page'            => 'boolean',
            'description'                => 'nullable|string|max:500',
        ]);

        $slug = Str::slug($request->name, '_');
        if (PlanModel::where('slug', $slug)->exists()) {
            $slug .= '_' . Str::random(4);
        }

        $maxOrder = PlanModel::max('sort_order') ?? 0;

        $plan = PlanModel::create([
            'name'                       => $request->name,
            'slug'                       => $slug,
            'price'                      => $request->price,
            'max_services'               => $request->max_services,
            'max_reservations_per_month' => $request->max_reservations_per_month,
            'max_employees'              => $request->max_employees,
            'has_push_notifications'     => $request->boolean('has_push_notifications'),
            'has_reports'                => $request->boolean('has_reports'),
            'has_reminders'              => $request->boolean('has_reminders'),
            'has_custom_page'            => $request->boolean('has_custom_page'),
            'is_active'                  => true,
            'sort_order'                 => $maxOrder + 1,
            'description'                => $request->description,
        ]);

        return response()->json(['data' => new PlanResource($plan)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $plan = PlanModel::findOrFail($id);

        $request->validate([
            'name'                       => 'sometimes|string|max:100',
            'price'                      => 'sometimes|numeric|min:0',
            'max_services'               => 'nullable|integer|min:0',
            'max_reservations_per_month' => 'nullable|integer|min:0',
            'max_employees'              => 'nullable|integer|min:0',
            'has_push_notifications'     => 'sometimes|boolean',
            'has_reports'                => 'sometimes|boolean',
            'has_reminders'              => 'sometimes|boolean',
            'has_custom_page'            => 'sometimes|boolean',
            'is_active'                  => 'sometimes|boolean',
            'sort_order'                 => 'sometimes|integer|min:0',
            'description'                => 'sometimes|nullable|string|max:500',
        ]);

        $plan->update($request->only([
            'name', 'price',
            'max_services', 'max_reservations_per_month', 'max_employees',
            'has_push_notifications', 'has_reports', 'has_reminders', 'has_custom_page',
            'is_active', 'sort_order', 'description',
        ]));

        return response()->json(['data' => new PlanResource($plan)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $plan = PlanModel::findOrFail($id);
        $plan->delete();

        return response()->json(['data' => ['message' => 'Plan deleted']]);
    }
}
```

- [ ] **Step 3: Add assignPlan to SuperAdminController**

In `apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php`, add method:

```php
    public function assignPlan(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
        ]);

        $tenant = TenantModel::findOrFail($id);
        $tenant->update([
            'plan_id' => $request->plan_id,
            'is_trial' => false,
        ]);

        return response()->json([
            'data' => ['message' => 'Plan assigned'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
```

- [ ] **Step 4: Add routes**

In `apps/backend/routes/api.php`, inside the `super_admin` middleware group (after line 149, before the closing `});`), add:

```php
            // Plans CRUD
            Route::get('plans', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'index']);
            Route::post('plans', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'store']);
            Route::patch('plans/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'update']);
            Route::delete('plans/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'destroy']);

            // Assign plan to tenant
            Route::post('tenants/{id}/assign-plan', [SuperAdminController::class, 'assignPlan']);
```

- [ ] **Step 5: Test API**

```bash
cd apps/backend && php artisan serve &
sleep 2
# Test plans list (requires auth — use tinker instead)
php artisan tinker --execute="echo App\Infrastructure\Persistence\Models\PlanModel::count() . ' plans exist';"
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/PlanController.php apps/backend/app/Infrastructure/Http/Resources/PlanResource.php apps/backend/routes/api.php apps/backend/app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php
git commit -m "feat(plans): add Plan CRUD controller, resource, routes, and assign-plan endpoint"
```

---

## Task 6: PlanLimitsService + enforcement in controllers

**Files:**
- Create: `apps/backend/app/Application/Services/PlanLimitsService.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Service/ServiceController.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/User/UserController.php`

- [ ] **Step 1: Create PlanLimitsService**

```php
<?php

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Carbon\Carbon;

class PlanLimitsService
{
    public function canCreateService(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;
        if ($plan->max_services === null) return true;

        $current = ServiceModel::where('tenant_id', $tenantId)->count();
        return $current < $plan->max_services;
    }

    public function canCreateReservation(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;
        if ($plan->max_reservations_per_month === null) return true;

        $current = ReservationModel::where('tenant_id', $tenantId)
            ->where('created_at', '>=', Carbon::now()->startOfMonth())
            ->count();
        return $current < $plan->max_reservations_per_month;
    }

    public function canAddEmployee(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;
        if ($plan->max_employees === null) return true;

        $current = TenantUserModel::where('tenant_id', $tenantId)
            ->whereIn('role', ['cashier', 'washer'])
            ->count();
        return $current < $plan->max_employees;
    }

    public function hasFeature(string $tenantId, string $feature): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;

        return match ($feature) {
            'push_notifications' => $plan->has_push_notifications,
            'reports'            => $plan->has_reports,
            'reminders'          => $plan->has_reminders,
            'custom_page'        => $plan->has_custom_page,
            default              => false,
        };
    }

    private function isTrialActive(TenantModel $tenant): bool
    {
        return $tenant->is_trial
            && $tenant->trial_ends_at !== null
            && $tenant->trial_ends_at->isFuture();
    }

    private function getPlan(TenantModel $tenant): ?PlanModel
    {
        if (!$tenant->plan_id) return null;

        return PlanModel::find($tenant->plan_id);
    }
}
```

- [ ] **Step 2: Add enforcement to ServiceController**

In `apps/backend/app/Infrastructure/Http/Controllers/Service/ServiceController.php`:

Add import:
```php
use App\Application\Services\PlanLimitsService;
```

Add constructor:
```php
    public function __construct(
        private PlanLimitsService $planLimits,
    ) {}
```

Add check at the beginning of `store()` method (before the existing `$service = ServiceModel::create`):
```php
        if (!$this->planLimits->canCreateService(app('current_tenant_id'))) {
            return response()->json([
                'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de servicios alcanzado. Actualiza tu plan.'],
            ], 403);
        }
```

- [ ] **Step 3: Add enforcement to ReservationController**

In `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php`:

Add import:
```php
use App\Application\Services\PlanLimitsService;
```

Add `PlanLimitsService` to constructor (after existing params):
```php
        private PlanLimitsService $planLimits,
```

Add check at the beginning of `store()` method (before the existing `$dto = new CreateReservationDTO`):
```php
        if (!$this->planLimits->canCreateReservation(app('current_tenant_id'))) {
            return response()->json([
                'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de reservas mensuales alcanzado. Actualiza tu plan.'],
            ], 403);
        }
```

- [ ] **Step 4: Add enforcement to UserController**

In `apps/backend/app/Infrastructure/Http/Controllers/User/UserController.php`:

Add import:
```php
use App\Application\Services\PlanLimitsService;
```

Add constructor:
```php
    public function __construct(
        private PlanLimitsService $planLimits,
    ) {}
```

Add check at the beginning of `store()` method (before the existing `$request->validate`), only for non-client roles:
```php
        if (in_array($request->role, ['cashier', 'washer', 'tenant_admin'])) {
            if (!$this->planLimits->canAddEmployee(app('current_tenant_id'))) {
                return response()->json([
                    'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de empleados alcanzado. Actualiza tu plan.'],
                ], 403);
            }
        }
```

Note: Move this check AFTER `$request->validate` so we know `$request->role` exists. Place it right after the validate block.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Application/Services/PlanLimitsService.php apps/backend/app/Infrastructure/Http/Controllers/Service/ServiceController.php apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php apps/backend/app/Infrastructure/Http/Controllers/User/UserController.php
git commit -m "feat(plans): add PlanLimitsService and enforce limits in service, reservation, and user controllers"
```

---

## Task 7: Trial auto-suspend command

**Files:**
- Create: `apps/backend/app/Infrastructure/Console/Commands/CheckExpiredTrialsCommand.php`
- Modify: `apps/backend/routes/console.php`

- [ ] **Step 1: Create command**

```php
<?php

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Console\Command;

class CheckExpiredTrialsCommand extends Command
{
    protected $signature = 'plan:check-trials';
    protected $description = 'Suspend tenants with expired trials';

    public function handle(): int
    {
        $expired = TenantModel::where('is_trial', true)
            ->where('trial_ends_at', '<', now())
            ->where('status', '!=', 'suspended')
            ->get();

        $count = 0;
        foreach ($expired as $tenant) {
            $tenant->update(['status' => 'suspended']);
            $count++;
            $this->info("Suspended: {$tenant->name} ({$tenant->slug})");
        }

        $this->info("Done. {$count} tenant(s) suspended.");

        return Command::SUCCESS;
    }
}
```

- [ ] **Step 2: Register in scheduler**

In `apps/backend/routes/console.php`, add after line 11:

```php
Schedule::command('plan:check-trials')->daily();
```

- [ ] **Step 3: Test command**

```bash
cd apps/backend && php artisan plan:check-trials
```

Expected: `Done. 0 tenant(s) suspended.` (or more if expired trials exist).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/Infrastructure/Console/Commands/CheckExpiredTrialsCommand.php apps/backend/routes/console.php
git commit -m "feat(plans): add daily command to auto-suspend expired trials"
```

---

## Task 8: Frontend — Plan entity + mapper + hooks

**Files:**
- Create: `apps/admin-v2/src/domain/entities/plan.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/plan.mapper.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-plans.ts`

- [ ] **Step 1: Create plan entity**

```typescript
export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  maxServices: number | null;
  maxReservationsPerMonth: number | null;
  maxEmployees: number | null;
  hasPushNotifications: boolean;
  hasReports: boolean;
  hasReminders: boolean;
  hasCustomPage: boolean;
  isActive: boolean;
  sortOrder: number;
  description: string | null;
  tenantsCount?: number;
  createdAt: Date;
}

export interface PlanSummary {
  id: string;
  name: string;
  slug: string;
  price: number;
}
```

- [ ] **Step 2: Create plan mapper**

```typescript
import type { Plan, PlanSummary } from '@/domain/entities/plan';

export function mapPlan(raw: Record<string, unknown>): Plan {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    price: raw.price as number,
    maxServices: (raw.max_services as number) ?? null,
    maxReservationsPerMonth: (raw.max_reservations_per_month as number) ?? null,
    maxEmployees: (raw.max_employees as number) ?? null,
    hasPushNotifications: raw.has_push_notifications as boolean,
    hasReports: raw.has_reports as boolean,
    hasReminders: raw.has_reminders as boolean,
    hasCustomPage: raw.has_custom_page as boolean,
    isActive: raw.is_active as boolean,
    sortOrder: (raw.sort_order as number) ?? 0,
    description: (raw.description as string) ?? null,
    tenantsCount: raw.tenants_count as number | undefined,
    createdAt: new Date(raw.created_at as string),
  };
}

export function mapPlanSummary(raw: Record<string, unknown>): PlanSummary {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    price: raw.price as number,
  };
}
```

- [ ] **Step 3: Create use-plans hook**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/infrastructure/api/client';
import { mapPlan } from '@/infrastructure/api/mappers/plan.mapper';
import type { Plan } from '@/domain/entities/plan';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data: res } = await api.get('/superadmin/plans');
      return (res.data as Record<string, unknown>[]).map(mapPlan);
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      price: number;
      max_services?: number | null;
      max_reservations_per_month?: number | null;
      max_employees?: number | null;
      has_push_notifications?: boolean;
      has_reports?: boolean;
      has_reminders?: boolean;
      has_custom_page?: boolean;
      description?: string;
    }) => {
      const { data: res } = await api.post('/superadmin/plans', data);
      return mapPlan(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      name: string;
      price: number;
      max_services: number | null;
      max_reservations_per_month: number | null;
      max_employees: number | null;
      has_push_notifications: boolean;
      has_reports: boolean;
      has_reminders: boolean;
      has_custom_page: boolean;
      is_active: boolean;
      sort_order: number;
      description: string | null;
    }>) => {
      const { data: res } = await api.patch(`/superadmin/plans/${id}`, data);
      return mapPlan(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/superadmin/plans/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useAssignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, planId }: { tenantId: string; planId: string }) => {
      await api.post(`/superadmin/tenants/${tenantId}/assign-plan`, { plan_id: planId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin-v2/src/domain/entities/plan.ts apps/admin-v2/src/infrastructure/api/mappers/plan.mapper.ts apps/admin-v2/src/presentation/hooks/use-plans.ts
git commit -m "feat(plans): add Plan entity, mapper, and CRUD hooks for admin frontend"
```

---

## Task 9: Frontend — Update tenant types + mapper for plan object

**Files:**
- Modify: `apps/admin-v2/src/domain/entities/tenant.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/mappers/tenant.mapper.ts`

- [ ] **Step 1: Update tenant entity**

In `apps/admin-v2/src/domain/entities/tenant.ts`:

Replace line 1:
```typescript
export type TenantPlan = 'trial' | 'basic' | 'pro';
```
With:
```typescript
import type { PlanSummary } from './plan';
```

In the `Tenant` interface, replace:
```typescript
  plan: TenantPlan;
```
With:
```typescript
  planId: string | null;
  isTrial: boolean;
  plan: PlanSummary | null;
```

- [ ] **Step 2: Update tenant mapper**

In `apps/admin-v2/src/infrastructure/api/mappers/tenant.mapper.ts`:

Add import:
```typescript
import { mapPlanSummary } from './plan.mapper';
```

Replace `plan: raw.plan as Tenant['plan'],` with:
```typescript
    planId: (raw.plan_id as string) ?? null,
    isTrial: (raw.is_trial as boolean) ?? false,
    plan: raw.plan ? mapPlanSummary(raw.plan as Record<string, unknown>) : null,
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/domain/entities/tenant.ts apps/admin-v2/src/infrastructure/api/mappers/tenant.mapper.ts
git commit -m "feat(plans): update Tenant entity and mapper to use plan object instead of enum"
```

---

## Task 10: Frontend — Plans CRUD page + nav link

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(super-admin)/plans/page.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(super-admin)/layout.tsx`

- [ ] **Step 1: Add Plans nav item**

In `apps/admin-v2/src/presentation/app/(super-admin)/layout.tsx`:

Add import `CreditCard` to the lucide-react import line:
```typescript
import { LayoutDashboard, Building2, Users, LogOut, Tags, CreditCard } from 'lucide-react';
```

Add to NAV_ITEMS array (after Categories, before Users):
```typescript
  { label: 'Planes', href: '/super-admin/plans', icon: CreditCard },
```

- [ ] **Step 2: Create Plans page**

```tsx
'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Infinity } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/presentation/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/presentation/components/ui/dialog';
import {
  usePlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from '@/presentation/hooks/use-plans';
import type { Plan } from '@/domain/entities/plan';

const EMPTY_FORM = {
  name: '',
  price: '',
  max_services: '',
  max_reservations_per_month: '',
  max_employees: '',
  has_push_notifications: false,
  has_reports: false,
  has_reminders: false,
  has_custom_page: false,
  description: '',
};

type PlanForm = typeof EMPTY_FORM;

function parseLimit(val: string): number | null {
  if (val === '' || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function limitDisplay(val: number | null): string {
  return val === null ? '∞' : String(val);
}

function formFromPlan(plan: Plan): PlanForm {
  return {
    name: plan.name,
    price: String(plan.price),
    max_services: plan.maxServices !== null ? String(plan.maxServices) : '',
    max_reservations_per_month: plan.maxReservationsPerMonth !== null ? String(plan.maxReservationsPerMonth) : '',
    max_employees: plan.maxEmployees !== null ? String(plan.maxEmployees) : '',
    has_push_notifications: plan.hasPushNotifications,
    has_reports: plan.hasReports,
    has_reminders: plan.hasReminders,
    has_custom_page: plan.hasCustomPage,
    description: plan.description ?? '',
  };
}

export default function PlansPage() {
  const { data: plans, isLoading, error } = usePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);

  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm(formFromPlan(plan));
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.price) return;

    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      max_services: parseLimit(form.max_services),
      max_reservations_per_month: parseLimit(form.max_reservations_per_month),
      max_employees: parseLimit(form.max_employees),
      has_push_notifications: form.has_push_notifications,
      has_reports: form.has_reports,
      has_reminders: form.has_reminders,
      has_custom_page: form.has_custom_page,
      description: form.description || undefined,
    };

    try {
      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, ...payload });
        toast.success('Plan actualizado');
      } else {
        await createPlan.mutateAsync(payload);
        toast.success('Plan creado');
      }
      setDialogOpen(false);
    } catch {
      toast.error(editingPlan ? 'Error al actualizar plan' : 'Error al crear plan');
    }
  }

  async function handleToggle(plan: Plan) {
    try {
      await updatePlan.mutateAsync({ id: plan.id, is_active: !plan.isActive });
      toast.success(plan.isActive ? 'Plan desactivado' : 'Plan activado');
    } catch {
      toast.error('Error al cambiar estado');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlan.mutateAsync(id);
      toast.success('Plan eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Planes</h1>
          <p className="text-sm text-muted-foreground">Administra los planes de membresía</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Crear plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar plan' : 'Crear plan'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Pro"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Precio ($/mes)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="19.99"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción corta del plan"
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Límites (vacío = ilimitado)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Max servicios</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.max_services}
                      onChange={(e) => setForm({ ...form, max_services: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max reservas/mes</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.max_reservations_per_month}
                      onChange={(e) => setForm({ ...form, max_reservations_per_month: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max empleados</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.max_employees}
                      onChange={(e) => setForm({ ...form, max_employees: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Features</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'has_push_notifications', label: 'Push notifications' },
                    { key: 'has_reports', label: 'Reportes' },
                    { key: 'has_reminders', label: 'Recordatorios' },
                    { key: 'has_custom_page', label: 'Página personalizada' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key as keyof PlanForm] as boolean}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="rounded border-zinc-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.price || createPlan.isPending || updatePlan.isPending}
                className="w-full"
              >
                {editingPlan ? 'Guardar cambios' : 'Crear plan'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Error al cargar planes
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Reservas/mes</TableHead>
                <TableHead>Empleados</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                  </TableCell>
                  <TableCell className="text-sm">{limitDisplay(plan.maxServices)}</TableCell>
                  <TableCell className="text-sm">{limitDisplay(plan.maxReservationsPerMonth)}</TableCell>
                  <TableCell className="text-sm">{limitDisplay(plan.maxEmployees)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {plan.hasPushNotifications && <Badge variant="outline" className="text-xs">Push</Badge>}
                      {plan.hasReports && <Badge variant="outline" className="text-xs">Reportes</Badge>}
                      {plan.hasReminders && <Badge variant="outline" className="text-xs">Recordatorios</Badge>}
                      {plan.hasCustomPage && <Badge variant="outline" className="text-xs">Página</Badge>}
                      {!plan.hasPushNotifications && !plan.hasReports && !plan.hasReminders && !plan.hasCustomPage && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{plan.tenantsCount ?? 0}</TableCell>
                  <TableCell>
                    <button onClick={() => handleToggle(plan)}>
                      <Badge
                        variant="outline"
                        className={
                          plan.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 cursor-pointer'
                        }
                      >
                        {plan.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(plan.id)} disabled={deletePlan.isPending}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/app/\(super-admin\)/plans/page.tsx apps/admin-v2/src/presentation/app/\(super-admin\)/layout.tsx
git commit -m "feat(plans): add Plans CRUD page and nav link in SuperAdmin"
```

---

## Task 11: Frontend — Update tenants page with plan badge + assign plan

**Files:**
- Modify: `apps/admin-v2/src/presentation/app/(super-admin)/tenants/page.tsx`

- [ ] **Step 1: Add imports and hooks**

Add imports at top:
```typescript
import { usePlans, useAssignPlan } from '@/presentation/hooks/use-plans';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { CreditCard } from 'lucide-react';
```

Inside component, add hooks:
```typescript
  const { data: plans } = usePlans();
  const assignPlan = useAssignPlan();
```

Add handler:
```typescript
  async function handleAssignPlan(tenantId: string, planId: string) {
    try {
      await assignPlan.mutateAsync({ tenantId, planId });
      toast.success('Plan asignado');
    } catch {
      toast.error('Error al asignar plan');
    }
  }
```

- [ ] **Step 2: Update Plan column in table**

Replace the existing plan badge cell (line 192-194):
```tsx
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{tenant.plan}</Badge>
                    </TableCell>
```

With:
```tsx
                    <TableCell>
                      {tenant.isTrial ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          Trial
                          {tenant.trialEndsAt && (
                            <span className="ml-1">
                              ({Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000))}d)
                            </span>
                          )}
                        </Badge>
                      ) : tenant.plan ? (
                        <Badge variant="outline" className="text-xs">
                          {tenant.plan.name} — ${tenant.plan.price}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200 text-xs">Sin plan</Badge>
                      )}
                    </TableCell>
```

- [ ] **Step 3: Add "Asignar plan" to dropdown menu**

In the DropdownMenuContent (after the existing "Entrar como tenant" item), add:

```tsx
                          {plans && plans.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Asignar plan</div>
                              {plans.filter(p => p.isActive).map((plan) => (
                                <DropdownMenuItem
                                  key={plan.id}
                                  onClick={() => handleAssignPlan(tenant.id, plan.id)}
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  {plan.name} — {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
```

- [ ] **Step 4: Start dev server and test in browser**

```bash
cd apps/admin-v2 && npm run dev
```

Verify:
1. Navigate to `/super-admin/plans` — see 4 default plans with CRUD working
2. Navigate to `/super-admin/tenants` — see plan badges, assign plan from dropdown
3. Create a new plan, edit it, toggle active, delete it
4. Assign a plan to a tenant and verify badge updates

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/presentation/app/\(super-admin\)/tenants/page.tsx
git commit -m "feat(plans): update tenants page with plan badges and assign-plan dropdown"
```

---

## Task 12: Fix any compile errors from TenantPlan removal

**Files:**
- Potentially: any file importing `TenantPlan` from `tenant.ts`

- [ ] **Step 1: Search for TenantPlan usage**

```bash
cd apps/admin-v2 && grep -r "TenantPlan" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Fix any broken references**

Remove or update any code referencing the old `TenantPlan` type. The tenants page used `TenantPlan` only for display — now replaced by `tenant.plan?.name`.

Check for usages in:
- Tenants page filter (if filtering by plan, update to use plan.slug or plan.id)
- Any type imports

- [ ] **Step 3: Verify build**

```bash
cd apps/admin-v2 && npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit if changes were needed**

```bash
git add -A && git commit -m "fix(plans): resolve TenantPlan type references after migration to plan object"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run backend**

```bash
cd apps/backend && php artisan serve
```

- [ ] **Step 2: Run frontend**

```bash
cd apps/admin-v2 && npm run dev
```

- [ ] **Step 3: Full test flow**

1. Login as super admin
2. Go to Plans page — verify 4 default plans show
3. Create new plan "Test Plan" — verify it appears
4. Edit plan — change price, toggle features — verify saves
5. Delete test plan — verify removed
6. Go to Tenants page — verify plan badges show correctly
7. Assign plan to a tenant via dropdown — verify badge updates
8. Test enforcement: login as tenant with Free plan, try creating >1 service — expect 403

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A && git commit -m "feat(plans): complete membership plans system with CRUD and enforcement"
```
