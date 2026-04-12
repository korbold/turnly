# WashFlow Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Laravel 13 backend for a multi-tenant car wash SaaS with domain-driven architecture, Sanctum auth, and tenant-scoped data isolation.

**Architecture:** Domain-driven design with three layers: Domain (entities, contracts, exceptions), Application (DTOs, use cases), Infrastructure (Eloquent models, repositories, controllers). Multi-tenancy via subdomain resolution and global TenantScope. All business logic lives in UseCases, never in controllers.

**Tech Stack:** Laravel 13, PHP 8.3, MySQL 8, Redis, Laravel Sanctum, Spatie Permission, Pest

---

## File Structure

```
washflow/
├── apps/backend/                          # Laravel 13 app
│   ├── app/
│   │   ├── Domain/
│   │   │   ├── Shared/
│   │   │   │   └── Exceptions/AppException.php
│   │   │   ├── Tenant/
│   │   │   │   ├── Entities/Tenant.php
│   │   │   │   ├── Contracts/TenantRepositoryInterface.php
│   │   │   │   └── Exceptions/
│   │   │   │       ├── TenantNotFoundException.php
│   │   │   │       ├── TenantSuspendedException.php
│   │   │   │       └── TenantSlugTakenException.php
│   │   │   ├── Reservation/
│   │   │   │   ├── Entities/Reservation.php
│   │   │   │   ├── Enums/ReservationStatus.php
│   │   │   │   ├── Contracts/ReservationRepositoryInterface.php
│   │   │   │   └── Exceptions/
│   │   │   │       ├── ReservationConflictException.php
│   │   │   │       ├── InvalidStatusTransitionException.php
│   │   │   │       └── OutsideBusinessHoursException.php
│   │   │   ├── WashLog/
│   │   │   │   ├── Entities/WashLog.php
│   │   │   │   ├── Contracts/WashLogRepositoryInterface.php
│   │   │   │   └── Exceptions/WashLogNotFoundException.php
│   │   │   ├── Vehicle/
│   │   │   │   ├── Entities/Vehicle.php
│   │   │   │   └── Contracts/VehicleRepositoryInterface.php
│   │   │   └── User/
│   │   │       ├── Entities/User.php
│   │   │       └── Contracts/UserRepositoryInterface.php
│   │   ├── Application/
│   │   │   ├── DTOs/
│   │   │   │   ├── Tenant/RegisterTenantDTO.php
│   │   │   │   ├── Tenant/ConfigureBusinessDTO.php
│   │   │   │   ├── Reservation/CreateReservationDTO.php
│   │   │   │   ├── Reservation/AvailableSlotsQueryDTO.php
│   │   │   │   ├── WashLog/CreateWashLogDTO.php
│   │   │   │   ├── WashLog/UpdateWashLogDTO.php
│   │   │   │   └── Vehicle/CreateVehicleDTO.php
│   │   │   └── UseCases/
│   │   │       ├── Tenant/
│   │   │       │   ├── RegisterTenantUseCase.php
│   │   │       │   ├── ActivateTenantUseCase.php
│   │   │       │   └── ConfigureBusinessUseCase.php
│   │   │       ├── Reservation/
│   │   │       │   ├── CreateReservationUseCase.php
│   │   │       │   ├── ConfirmReservationUseCase.php
│   │   │       │   ├── CancelReservationUseCase.php
│   │   │       │   ├── StartWashUseCase.php
│   │   │       │   ├── CompleteWashUseCase.php
│   │   │       │   └── GetAvailableSlotsUseCase.php
│   │   │       ├── WashLog/
│   │   │       │   ├── CreateWashLogUseCase.php
│   │   │       │   ├── UpdateWashLogUseCase.php
│   │   │       │   └── GetDailyLogUseCase.php
│   │   │       └── Vehicle/
│   │   │           ├── CreateVehicleUseCase.php
│   │   │           └── GetVehicleHistoryUseCase.php
│   │   └── Infrastructure/
│   │       ├── Http/
│   │       │   ├── Controllers/
│   │       │   │   ├── Auth/AuthController.php
│   │       │   │   ├── Auth/OnboardingController.php
│   │       │   │   ├── Tenant/TenantSettingsController.php
│   │       │   │   ├── Reservation/ReservationController.php
│   │       │   │   ├── WashLog/WashLogController.php
│   │       │   │   ├── Vehicle/VehicleController.php
│   │       │   │   ├── Service/ServiceController.php
│   │       │   │   ├── User/UserController.php
│   │       │   │   ├── Report/ReportController.php
│   │       │   │   └── SuperAdmin/SuperAdminController.php
│   │       │   ├── Requests/
│   │       │   │   ├── Auth/RegisterRequest.php
│   │       │   │   ├── Auth/LoginRequest.php
│   │       │   │   ├── Onboarding/RegisterTenantRequest.php
│   │       │   │   ├── Reservation/CreateReservationRequest.php
│   │       │   │   ├── WashLog/CreateWashLogRequest.php
│   │       │   │   ├── Vehicle/CreateVehicleRequest.php
│   │       │   │   └── Service/CreateServiceRequest.php
│   │       │   ├── Resources/
│   │       │   │   ├── TenantResource.php
│   │       │   │   ├── ReservationResource.php
│   │       │   │   ├── WashLogResource.php
│   │       │   │   ├── VehicleResource.php
│   │       │   │   ├── ServiceResource.php
│   │       │   │   └── UserResource.php
│   │       │   └── Middleware/
│   │       │       ├── ResolveTenantMiddleware.php
│   │       │       └── EnsureSuperAdminMiddleware.php
│   │       ├── Persistence/
│   │       │   ├── Models/
│   │       │   │   ├── TenantModel.php
│   │       │   │   ├── UserModel.php
│   │       │   │   ├── TenantUserModel.php
│   │       │   │   ├── VehicleModel.php
│   │       │   │   ├── ServiceModel.php
│   │       │   │   ├── AvailabilitySlotModel.php
│   │       │   │   ├── ReservationModel.php
│   │       │   │   └── WashLogModel.php
│   │       │   ├── Repositories/
│   │       │   │   ├── EloquentTenantRepository.php
│   │       │   │   ├── EloquentReservationRepository.php
│   │       │   │   ├── EloquentWashLogRepository.php
│   │       │   │   ├── EloquentVehicleRepository.php
│   │       │   │   └── EloquentUserRepository.php
│   │       │   └── Scopes/
│   │       │       └── TenantScope.php
│   │       └── Providers/
│   │           └── RepositoryServiceProvider.php
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 0001_01_01_000000_create_tenants_table.php
│   │   │   ├── 0001_01_01_000001_create_users_table.php    (modify existing)
│   │   │   ├── 0001_01_01_000002_create_tenant_users_table.php
│   │   │   ├── 0001_01_01_000003_create_vehicles_table.php
│   │   │   ├── 0001_01_01_000004_create_services_table.php
│   │   │   ├── 0001_01_01_000005_create_availability_slots_table.php
│   │   │   ├── 0001_01_01_000006_create_reservations_table.php
│   │   │   └── 0001_01_01_000007_create_wash_logs_table.php
│   │   └── seeders/
│   │       ├── DatabaseSeeder.php
│   │       ├── TenantSeeder.php
│   │       ├── UserSeeder.php
│   │       ├── ServiceSeeder.php
│   │       ├── AvailabilitySlotSeeder.php
│   │       ├── ReservationSeeder.php
│   │       └── WashLogSeeder.php
│   ├── routes/
│   │   └── api.php
│   └── tests/
│       └── Feature/
│           ├── Auth/AuthTest.php
│           ├── Tenant/TenantMiddlewareTest.php
│           ├── Reservation/ReservationTest.php
│           ├── WashLog/WashLogTest.php
│           ├── Vehicle/VehicleTest.php
│           └── Service/ServiceTest.php
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

### Task 1: Monorepo structure + Docker Compose + Git init

**Files:**
- Create: `docker-compose.yml`
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/` directories
- Create: `docs/api.md`
- Create: `docs/architecture.md`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git init
```

- [ ] **Step 2: Create monorepo directory structure**

```bash
mkdir -p apps/backend apps/admin apps/mobile docs
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: washflow
      MYSQL_USER: washflow
      MYSQL_PASSWORD: secret
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  mysql_data:
```

- [ ] **Step 4: Create .gitignore**

Root gitignore covering all apps: vendor, node_modules, .env, build artifacts, IDE files.

- [ ] **Step 5: Create README.md and docs stubs**

- [ ] **Step 6: Start Docker services and verify**

```bash
docker compose up -d
docker compose ps  # all 3 services healthy
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(fase-1): scaffold monorepo structure with Docker Compose"
```

---

### Task 2: Laravel 13 setup + packages

**Files:**
- Create: `apps/backend/` (Laravel project)
- Modify: `apps/backend/.env`
- Modify: `apps/backend/composer.json`

- [ ] **Step 1: Create Laravel project**

```bash
cd apps/backend
composer create-project laravel/laravel . "13.*"
```

- [ ] **Step 2: Install dependencies**

```bash
composer require laravel/sanctum spatie/laravel-permission
composer require --dev pestphp/pest pestphp/pest-plugin-laravel
```

- [ ] **Step 3: Initialize Pest**

```bash
./vendor/bin/pest --init
```

- [ ] **Step 4: Configure .env**

Set DB_HOST=127.0.0.1, DB_DATABASE=washflow, DB_USERNAME=washflow, DB_PASSWORD=secret, CACHE_STORE=redis, QUEUE_CONNECTION=redis, REDIS_HOST=127.0.0.1.

- [ ] **Step 5: Publish Sanctum and Spatie configs**

```bash
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

- [ ] **Step 6: Verify base install works**

```bash
php artisan --version
php artisan migrate  # default Laravel migrations
./vendor/bin/pest    # base tests pass
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(fase-1): Laravel 13 setup with Sanctum, Spatie Permission, Pest"
```

---

### Task 3: Domain layer — base exception + Tenant domain

**Files:**
- Create: `app/Domain/Shared/Exceptions/AppException.php`
- Create: `app/Domain/Tenant/Entities/Tenant.php`
- Create: `app/Domain/Tenant/Contracts/TenantRepositoryInterface.php`
- Create: `app/Domain/Tenant/Exceptions/TenantNotFoundException.php`
- Create: `app/Domain/Tenant/Exceptions/TenantSuspendedException.php`
- Create: `app/Domain/Tenant/Exceptions/TenantSlugTakenException.php`

- [ ] **Step 1: Create AppException base class**

```php
<?php
namespace App\Domain\Shared\Exceptions;

use Exception;

abstract class AppException extends Exception
{
    abstract public function getErrorCode(): string;
    abstract public function getStatusCode(): int;

    public function getContext(): array
    {
        return [];
    }
}
```

- [ ] **Step 2: Create Tenant entity (value object)**

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
        public string $plan,
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

    public function isTrialExpired(): bool
    {
        return $this->plan === 'trial'
            && $this->trialEndsAt !== null
            && $this->trialEndsAt < new \DateTimeImmutable();
    }
}
```

- [ ] **Step 3: Create TenantRepositoryInterface**

```php
<?php
namespace App\Domain\Tenant\Contracts;

use App\Domain\Tenant\Entities\Tenant;

interface TenantRepositoryInterface
{
    public function findById(string $id): ?Tenant;
    public function findBySlug(string $slug): ?Tenant;
    public function findByEmail(string $email): ?Tenant;
    public function slugExists(string $slug): bool;
    public function save(Tenant $tenant): Tenant;
    public function updateStatus(string $id, string $status): void;
    public function updateSettings(string $id, array $settings): void;
    public function all(int $perPage = 15): array;
}
```

- [ ] **Step 4: Create Tenant exceptions**

TenantNotFoundException (404, TENANT_NOT_FOUND), TenantSuspendedException (403, TENANT_SUSPENDED), TenantSlugTakenException (422, TENANT_SLUG_TAKEN). Each extends AppException.

- [ ] **Step 5: Commit**

```bash
git add app/Domain/
git commit -m "feat(fase-1): domain layer - Tenant entity, contract, and exceptions"
```

---

### Task 4: Domain layer — Reservation, WashLog, Vehicle, User

**Files:**
- Create: `app/Domain/Reservation/Entities/Reservation.php`
- Create: `app/Domain/Reservation/Enums/ReservationStatus.php`
- Create: `app/Domain/Reservation/Contracts/ReservationRepositoryInterface.php`
- Create: `app/Domain/Reservation/Exceptions/*.php` (3 files)
- Create: `app/Domain/WashLog/Entities/WashLog.php`
- Create: `app/Domain/WashLog/Contracts/WashLogRepositoryInterface.php`
- Create: `app/Domain/WashLog/Exceptions/WashLogNotFoundException.php`
- Create: `app/Domain/Vehicle/Entities/Vehicle.php`
- Create: `app/Domain/Vehicle/Contracts/VehicleRepositoryInterface.php`
- Create: `app/Domain/User/Entities/User.php`
- Create: `app/Domain/User/Contracts/UserRepositoryInterface.php`

- [ ] **Step 1: Create ReservationStatus enum**

```php
<?php
namespace App\Domain\Reservation\Enums;

enum ReservationStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Pending => in_array($next, [self::Confirmed, self::Cancelled]),
            self::Confirmed => in_array($next, [self::InProgress, self::Cancelled, self::NoShow]),
            self::InProgress => in_array($next, [self::Completed]),
            self::Completed, self::Cancelled, self::NoShow => false,
        };
    }
}
```

- [ ] **Step 2: Create Reservation entity**

Readonly class with: id, tenantId, clientId, vehicleId, serviceId, assignedTo, scheduledAt, estimatedEnd, status (ReservationStatus), notes, cancelledAt, cancelReason, createdBy.

- [ ] **Step 3: Create ReservationRepositoryInterface**

Methods: findById, findByTenantAndDate, findConflicting, save, updateStatus, getAvailableSlots.

- [ ] **Step 4: Create Reservation exceptions**

ReservationConflictException (409), InvalidStatusTransitionException (422), OutsideBusinessHoursException (422).

- [ ] **Step 5: Create WashLog entity + contract + exception**

Entity: id, tenantId, vehicleId, serviceId, reservationId, attendedBy, createdBy, startedAt, finishedAt, priceCharged, paymentMethod, status, notes, logDate.
Contract: findById, findByTenantAndDate, save, complete, getDailySummary.
Exception: WashLogNotFoundException (404).

- [ ] **Step 6: Create Vehicle entity + contract**

Entity: id, tenantId, ownerId, plate, brand, model, color, type.
Contract: findById, findByPlate, findByOwner, save, getHistory.

- [ ] **Step 7: Create User entity + contract**

Entity: id, name, email, phone, isSuperAdmin.
Contract: findById, findByEmail, save.

- [ ] **Step 8: Commit**

```bash
git add app/Domain/
git commit -m "feat(fase-1): domain layer - all entities, contracts, and exceptions"
```

---

### Task 5: Migrations (all 8 tables)

**Files:**
- Create: `database/migrations/2026_04_11_000001_create_tenants_table.php`
- Modify: `database/migrations/*_create_users_table.php` (add UUID + fields)
- Create: `database/migrations/2026_04_11_000003_create_tenant_users_table.php`
- Create: `database/migrations/2026_04_11_000004_create_vehicles_table.php`
- Create: `database/migrations/2026_04_11_000005_create_services_table.php`
- Create: `database/migrations/2026_04_11_000006_create_availability_slots_table.php`
- Create: `database/migrations/2026_04_11_000007_create_reservations_table.php`
- Create: `database/migrations/2026_04_11_000008_create_wash_logs_table.php`

- [ ] **Step 1: Create tenants migration**

Exact schema from spec: UUID primary, slug unique, name, owner_name, email unique, phone, city, country (default 'EC'), plan enum, status enum, trial_ends_at, settings JSON, onboarding_step, activated_at, timestamps, softDeletes.

- [ ] **Step 2: Modify users migration for UUID + extra fields**

Change id to `$table->uuid('id')->primary()`. Add phone (nullable), is_super_admin (default false). Remove auto-increment.

- [ ] **Step 3: Create tenant_users migration**

UUID primary, tenant_id + user_id with foreign keys + unique constraint, role string, is_active boolean.

- [ ] **Step 4: Create vehicles migration**

UUID primary, tenant_id, owner_id FK users, plate, brand, model, color, type enum. Unique on (tenant_id, plate). SoftDeletes.

- [ ] **Step 5: Create services migration**

UUID primary, tenant_id, name, description, price decimal(8,2), duration_minutes, is_active, sort_order. SoftDeletes.

- [ ] **Step 6: Create availability_slots migration**

UUID primary, tenant_id, day_of_week tinyInt, start_time, end_time, max_concurrent, is_active.

- [ ] **Step 7: Create reservations migration**

UUID primary, tenant_id, client_id, vehicle_id, service_id, assigned_to nullable, scheduled_at, estimated_end, status enum, notes, cancelled_at, cancel_reason, created_by. Composite index (tenant_id, scheduled_at, status). SoftDeletes.

- [ ] **Step 8: Create wash_logs migration**

UUID primary, tenant_id, vehicle_id, service_id, reservation_id nullable, attended_by, created_by, started_at, finished_at nullable, price_charged decimal, payment_method enum, status enum, notes, log_date. Composite index (tenant_id, log_date).

- [ ] **Step 9: Run migrations and verify**

```bash
php artisan migrate:fresh
php artisan migrate:status  # all migrations ran
```

- [ ] **Step 10: Commit**

```bash
git add database/migrations/
git commit -m "feat(fase-1): all 8 database migrations with UUIDs and indexes"
```

---

### Task 6: TenantScope + ResolveTenantMiddleware + exception handler

**Files:**
- Create: `app/Infrastructure/Persistence/Scopes/TenantScope.php`
- Create: `app/Infrastructure/Http/Middleware/ResolveTenantMiddleware.php`
- Create: `app/Infrastructure/Http/Middleware/EnsureSuperAdminMiddleware.php`
- Modify: `bootstrap/app.php` (exception handler + middleware aliases)
- Test: `tests/Feature/Tenant/TenantMiddlewareTest.php`

- [ ] **Step 1: Write test for ResolveTenantMiddleware**

```php
<?php
use App\Infrastructure\Persistence\Models\TenantModel;

test('resolves tenant from subdomain', function () {
    $tenant = TenantModel::factory()->create(['slug' => 'demo', 'status' => 'active']);

    $this->withHeader('Host', 'demo.washflow.test')
        ->getJson('/api/v1/services')
        ->assertStatus(401); // 401 because auth required, but tenant resolved

    expect(app('current_tenant')->id)->toBe($tenant->id);
});

test('returns 404 for unknown subdomain', function () {
    $this->withHeader('Host', 'unknown.washflow.test')
        ->getJson('/api/v1/services')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'TENANT_NOT_FOUND');
});

test('returns 403 for suspended tenant', function () {
    TenantModel::factory()->create(['slug' => 'suspended', 'status' => 'suspended']);

    $this->withHeader('Host', 'suspended.washflow.test')
        ->getJson('/api/v1/services')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_SUSPENDED');
});
```

- [ ] **Step 2: Create TenantScope**

Global scope that filters by `tenant_id` when `current_tenant_id` is bound in the container.

- [ ] **Step 3: Create ResolveTenantMiddleware**

Exact implementation from spec: parse subdomain, skip reserved slugs, lookup tenant, abort if not found/suspended, bind to container.

- [ ] **Step 4: Create EnsureSuperAdminMiddleware**

Check `$request->user()->is_super_admin === true`, return 403 if not.

- [ ] **Step 5: Configure exception handler in bootstrap/app.php**

Render AppException instances as JSON with code, message, context.

- [ ] **Step 6: Register middleware aliases**

In bootstrap/app.php: `tenant` → ResolveTenantMiddleware, `super_admin` → EnsureSuperAdminMiddleware.

- [ ] **Step 7: Run tests**

```bash
./vendor/bin/pest tests/Feature/Tenant/
```

- [ ] **Step 8: Commit**

```bash
git add app/Infrastructure/ bootstrap/app.php tests/
git commit -m "feat(fase-1): TenantScope, ResolveTenantMiddleware, exception handler"
```

---

### Task 7: Eloquent models with TenantScope + factories

**Files:**
- Create: `app/Infrastructure/Persistence/Models/TenantModel.php`
- Create: `app/Infrastructure/Persistence/Models/UserModel.php`
- Create: `app/Infrastructure/Persistence/Models/TenantUserModel.php`
- Create: `app/Infrastructure/Persistence/Models/VehicleModel.php`
- Create: `app/Infrastructure/Persistence/Models/ServiceModel.php`
- Create: `app/Infrastructure/Persistence/Models/AvailabilitySlotModel.php`
- Create: `app/Infrastructure/Persistence/Models/ReservationModel.php`
- Create: `app/Infrastructure/Persistence/Models/WashLogModel.php`
- Create: `database/factories/` (one per model)

- [ ] **Step 1: Create TenantModel**

UUID primary, table 'tenants', fillable fields, casts (settings → array, trial_ends_at → datetime, activated_at → datetime), softDeletes. No TenantScope (it IS the tenant).

- [ ] **Step 2: Create UserModel**

Extend Authenticatable. UUID trait. HasApiTokens (Sanctum). Fields: name, email, password, phone, is_super_admin. Relationship: tenants() through tenant_users.

- [ ] **Step 3: Create remaining models**

TenantUserModel, VehicleModel, ServiceModel, AvailabilitySlotModel, ReservationModel, WashLogModel. Each with:
- UUID primary key
- TenantScope in `booted()`
- Proper fillable, casts, relationships
- SoftDeletes where specified

- [ ] **Step 4: Create factories for all models**

Realistic data using Faker. TenantFactory generates slugs, ServiceFactory generates car wash service names/prices, ReservationFactory uses valid status values, etc.

- [ ] **Step 5: Verify models load correctly**

```bash
php artisan tinker --execute="App\Infrastructure\Persistence\Models\TenantModel::factory()->make()"
```

- [ ] **Step 6: Commit**

```bash
git add app/Infrastructure/Persistence/Models/ database/factories/
git commit -m "feat(fase-1): Eloquent models with TenantScope, UUID, factories"
```

---

### Task 8: Repositories + RepositoryServiceProvider

**Files:**
- Create: `app/Infrastructure/Persistence/Repositories/EloquentTenantRepository.php`
- Create: `app/Infrastructure/Persistence/Repositories/EloquentReservationRepository.php`
- Create: `app/Infrastructure/Persistence/Repositories/EloquentWashLogRepository.php`
- Create: `app/Infrastructure/Persistence/Repositories/EloquentVehicleRepository.php`
- Create: `app/Infrastructure/Persistence/Repositories/EloquentUserRepository.php`
- Create: `app/Infrastructure/Providers/RepositoryServiceProvider.php`
- Modify: `bootstrap/providers.php`

- [ ] **Step 1: Create EloquentTenantRepository**

Implements TenantRepositoryInterface. Maps between TenantModel (Eloquent) and Tenant (domain entity). All methods query via TenantModel and return domain entities.

- [ ] **Step 2: Create remaining repositories**

Each implements its domain contract. Maps Eloquent models to domain entities. Uses TenantScope automatically for scoped queries.

- [ ] **Step 3: Create RepositoryServiceProvider**

Binds each interface to its Eloquent implementation:
```php
$this->app->bind(TenantRepositoryInterface::class, EloquentTenantRepository::class);
// ... etc
```

- [ ] **Step 4: Register provider in bootstrap/providers.php**

- [ ] **Step 5: Commit**

```bash
git add app/Infrastructure/
git commit -m "feat(fase-1): repository implementations + service provider bindings"
```

---

### Task 9: Application layer — DTOs

**Files:**
- Create: `app/Application/DTOs/Tenant/RegisterTenantDTO.php`
- Create: `app/Application/DTOs/Tenant/ConfigureBusinessDTO.php`
- Create: `app/Application/DTOs/Reservation/CreateReservationDTO.php`
- Create: `app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php`
- Create: `app/Application/DTOs/WashLog/CreateWashLogDTO.php`
- Create: `app/Application/DTOs/WashLog/UpdateWashLogDTO.php`
- Create: `app/Application/DTOs/Vehicle/CreateVehicleDTO.php`

- [ ] **Step 1: Create all DTOs**

Each DTO is a `readonly class` with a `fromArray(array $data): static` factory method. Example:

```php
<?php
namespace App\Application\DTOs\Tenant;

final readonly class RegisterTenantDTO
{
    public function __construct(
        public string $name,
        public string $slug,
        public string $ownerName,
        public string $email,
        public string $password,
        public ?string $phone = null,
        public ?string $city = null,
        public string $country = 'EC',
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            name: $data['name'],
            slug: $data['slug'],
            ownerName: $data['owner_name'],
            email: $data['email'],
            password: $data['password'],
            phone: $data['phone'] ?? null,
            city: $data['city'] ?? null,
            country: $data['country'] ?? 'EC',
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Application/DTOs/
git commit -m "feat(fase-1): application layer DTOs"
```

---

### Task 10: Application layer — Use Cases (Tenant + Auth)

**Files:**
- Create: `app/Application/UseCases/Tenant/RegisterTenantUseCase.php`
- Create: `app/Application/UseCases/Tenant/ActivateTenantUseCase.php`
- Create: `app/Application/UseCases/Tenant/ConfigureBusinessUseCase.php`
- Test: `tests/Feature/Auth/AuthTest.php`

- [ ] **Step 1: Write tests for tenant registration flow**

Test: RegisterTenantUseCase creates tenant + owner user + tenant_user pivot. Test slug uniqueness check. Test activation changes status.

- [ ] **Step 2: Implement RegisterTenantUseCase**

Creates tenant (status: pending, plan: trial, trial_ends_at: +14 days), creates user (hashed password), creates tenant_user (role: tenant_admin). Returns tenant. Throws TenantSlugTakenException if slug exists.

- [ ] **Step 3: Implement ActivateTenantUseCase**

Changes status from pending to active, sets activated_at. Throws TenantNotFoundException.

- [ ] **Step 4: Implement ConfigureBusinessUseCase**

Updates tenant settings (business hours, services config), increments onboarding_step.

- [ ] **Step 5: Run tests**

```bash
./vendor/bin/pest tests/Feature/Auth/
```

- [ ] **Step 6: Commit**

```bash
git add app/Application/UseCases/Tenant/ tests/
git commit -m "feat(fase-1): tenant use cases - register, activate, configure"
```

---

### Task 11: Use Cases — Reservations

**Files:**
- Create: `app/Application/UseCases/Reservation/CreateReservationUseCase.php`
- Create: `app/Application/UseCases/Reservation/ConfirmReservationUseCase.php`
- Create: `app/Application/UseCases/Reservation/CancelReservationUseCase.php`
- Create: `app/Application/UseCases/Reservation/StartWashUseCase.php`
- Create: `app/Application/UseCases/Reservation/CompleteWashUseCase.php`
- Create: `app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php`
- Test: `tests/Feature/Reservation/ReservationTest.php`

- [ ] **Step 1: Write tests for reservation lifecycle**

Test: create reservation checks no time conflict, confirm transitions pending→confirmed, start transitions confirmed→in_progress, complete transitions in_progress→completed, cancel works from pending/confirmed, invalid transitions throw InvalidStatusTransitionException.

- [ ] **Step 2: Write test for available slots**

Test: GetAvailableSlotsUseCase returns slots for a date, excluding already-booked times, respecting max_concurrent.

- [ ] **Step 3: Implement CreateReservationUseCase**

Validates: service exists, vehicle exists, scheduled_at is within availability slots (OutsideBusinessHoursException), no conflict with existing reservations (ReservationConflictException). Creates reservation with status pending, calculates estimated_end from service duration.

- [ ] **Step 4: Implement status transition use cases**

ConfirmReservationUseCase, CancelReservationUseCase, StartWashUseCase, CompleteWashUseCase. Each validates transition via `ReservationStatus::canTransitionTo()`.

- [ ] **Step 5: Implement GetAvailableSlotsUseCase**

Query availability_slots for the date's day_of_week. For each slot time window, generate time intervals by service duration. Exclude intervals that would exceed max_concurrent based on existing reservations. Return available DateTime slots.

- [ ] **Step 6: Run tests**

```bash
./vendor/bin/pest tests/Feature/Reservation/
```

- [ ] **Step 7: Commit**

```bash
git add app/Application/UseCases/Reservation/ tests/
git commit -m "feat(fase-1): reservation use cases with conflict detection and slot availability"
```

---

### Task 12: Use Cases — WashLog + Vehicle

**Files:**
- Create: `app/Application/UseCases/WashLog/CreateWashLogUseCase.php`
- Create: `app/Application/UseCases/WashLog/UpdateWashLogUseCase.php`
- Create: `app/Application/UseCases/WashLog/GetDailyLogUseCase.php`
- Create: `app/Application/UseCases/Vehicle/CreateVehicleUseCase.php`
- Create: `app/Application/UseCases/Vehicle/GetVehicleHistoryUseCase.php`
- Test: `tests/Feature/WashLog/WashLogTest.php`
- Test: `tests/Feature/Vehicle/VehicleTest.php`

- [ ] **Step 1: Write tests for wash log CRUD**

Test: create walk-in wash log (no reservation_id), create from reservation (with reservation_id), complete wash log sets finished_at and status=completed, daily summary returns count + total revenue + payment method breakdown.

- [ ] **Step 2: Implement WashLog use cases**

CreateWashLogUseCase: creates log with log_date=today, status=in_progress.
UpdateWashLogUseCase: updates notes, payment_method.
GetDailyLogUseCase: returns logs for a date with summary (total count, total revenue, grouped by payment method).

- [ ] **Step 3: Write tests for vehicle**

Test: create vehicle with unique plate per tenant, get vehicle history returns wash logs.

- [ ] **Step 4: Implement Vehicle use cases**

CreateVehicleUseCase: validates plate unique within tenant.
GetVehicleHistoryUseCase: returns wash_logs for vehicle ordered by date desc.

- [ ] **Step 5: Run tests**

```bash
./vendor/bin/pest tests/Feature/WashLog/ tests/Feature/Vehicle/
```

- [ ] **Step 6: Commit**

```bash
git add app/Application/UseCases/ tests/
git commit -m "feat(fase-1): wash log and vehicle use cases"
```

---

### Task 13: HTTP layer — Form Requests + API Resources

**Files:**
- Create: `app/Infrastructure/Http/Requests/Auth/RegisterRequest.php`
- Create: `app/Infrastructure/Http/Requests/Auth/LoginRequest.php`
- Create: `app/Infrastructure/Http/Requests/Onboarding/RegisterTenantRequest.php`
- Create: `app/Infrastructure/Http/Requests/Reservation/CreateReservationRequest.php`
- Create: `app/Infrastructure/Http/Requests/WashLog/CreateWashLogRequest.php`
- Create: `app/Infrastructure/Http/Requests/Vehicle/CreateVehicleRequest.php`
- Create: `app/Infrastructure/Http/Requests/Service/CreateServiceRequest.php`
- Create: `app/Infrastructure/Http/Resources/TenantResource.php`
- Create: `app/Infrastructure/Http/Resources/ReservationResource.php`
- Create: `app/Infrastructure/Http/Resources/WashLogResource.php`
- Create: `app/Infrastructure/Http/Resources/VehicleResource.php`
- Create: `app/Infrastructure/Http/Resources/ServiceResource.php`
- Create: `app/Infrastructure/Http/Resources/UserResource.php`

- [ ] **Step 1: Create Form Requests**

Each extends FormRequest with `authorize(): bool` (return true, auth handled by middleware) and `rules(): array` with validation rules matching the migration constraints.

- [ ] **Step 2: Create API Resources**

Each extends JsonResource. Wraps response in `{ data: { ... }, meta: { tenant, timestamp } }` format. Use `additional()` for meta.

- [ ] **Step 3: Commit**

```bash
git add app/Infrastructure/Http/Requests/ app/Infrastructure/Http/Resources/
git commit -m "feat(fase-1): form requests and API resources"
```

---

### Task 14: Controllers + Routes

**Files:**
- Create: `app/Infrastructure/Http/Controllers/Auth/AuthController.php`
- Create: `app/Infrastructure/Http/Controllers/Auth/OnboardingController.php`
- Create: `app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php`
- Create: `app/Infrastructure/Http/Controllers/Reservation/ReservationController.php`
- Create: `app/Infrastructure/Http/Controllers/WashLog/WashLogController.php`
- Create: `app/Infrastructure/Http/Controllers/Vehicle/VehicleController.php`
- Create: `app/Infrastructure/Http/Controllers/Service/ServiceController.php`
- Create: `app/Infrastructure/Http/Controllers/User/UserController.php`
- Create: `app/Infrastructure/Http/Controllers/Report/ReportController.php`
- Create: `app/Infrastructure/Http/Controllers/SuperAdmin/SuperAdminController.php`
- Modify: `routes/api.php`

- [ ] **Step 1: Create AuthController**

register (create user + token), login (validate credentials + return token), logout (revoke token). Zero business logic — delegates to use cases.

- [ ] **Step 2: Create OnboardingController**

register (RegisterTenantUseCase), verify (ActivateTenantUseCase), checkSlug (TenantRepository::slugExists).

- [ ] **Step 3: Create tenant-scoped controllers**

ReservationController (CRUD + status transitions + available-slots), WashLogController (CRUD + complete + summary), VehicleController (CRUD + history), ServiceController (CRUD), TenantSettingsController (get/update), UserController (list + role update), ReportController (daily/weekly/monthly).

- [ ] **Step 4: Create SuperAdminController**

List tenants, suspend, activate. Protected by EnsureSuperAdminMiddleware.

- [ ] **Step 5: Define routes in api.php**

```php
Route::prefix('v1')->group(function () {
    // Public
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::prefix('onboarding')->group(function () {
        Route::post('register', [OnboardingController::class, 'register']);
        Route::post('verify', [OnboardingController::class, 'verify']);
        Route::get('check-slug', [OnboardingController::class, 'checkSlug']);
    });

    // Authenticated
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // Tenant-scoped
        Route::middleware('tenant')->group(function () {
            Route::get('tenant/settings', [TenantSettingsController::class, 'show']);
            Route::patch('tenant/settings', [TenantSettingsController::class, 'update']);
            Route::apiResource('reservations', ReservationController::class)->only(['index', 'store', 'show']);
            Route::patch('reservations/{reservation}/confirm', [ReservationController::class, 'confirm']);
            Route::patch('reservations/{reservation}/start', [ReservationController::class, 'start']);
            Route::patch('reservations/{reservation}/complete', [ReservationController::class, 'complete']);
            Route::patch('reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
            Route::get('reservations/available-slots', [ReservationController::class, 'availableSlots']);
            // ... wash-logs, vehicles, services, users, reports
        });

        // Super admin
        Route::middleware('super_admin')->prefix('superadmin')->group(function () {
            Route::get('tenants', [SuperAdminController::class, 'index']);
            Route::patch('tenants/{tenant}/suspend', [SuperAdminController::class, 'suspend']);
            Route::patch('tenants/{tenant}/activate', [SuperAdminController::class, 'activate']);
        });
    });
});
```

- [ ] **Step 6: Run route list to verify**

```bash
php artisan route:list --path=api/v1
```

- [ ] **Step 7: Commit**

```bash
git add app/Infrastructure/Http/Controllers/ routes/api.php
git commit -m "feat(fase-1): all controllers and API routes"
```

---

### Task 15: Seeders

**Files:**
- Modify: `database/seeders/DatabaseSeeder.php`
- Create: `database/seeders/TenantSeeder.php`
- Create: `database/seeders/UserSeeder.php`
- Create: `database/seeders/ServiceSeeder.php`
- Create: `database/seeders/AvailabilitySlotSeeder.php`
- Create: `database/seeders/ReservationSeeder.php`
- Create: `database/seeders/WashLogSeeder.php`

- [ ] **Step 1: Create TenantSeeder**

2 tenants: "Lavadora López" (slug: lavadora-lopez) and "Auto Spa Centro" (slug: auto-spa-centro). Both active.

- [ ] **Step 2: Create UserSeeder**

1 super_admin (super@washflow.com). Per tenant: 1 tenant_admin, 1 cashier, 1 washer, 5 clients. Create tenant_user pivots with roles.

- [ ] **Step 3: Create ServiceSeeder**

4 services per tenant: Lavado Básico ($5, 20min), Lavado Completo ($10, 40min), Aspirado Interior ($8, 30min), Encerado Premium ($15, 60min).

- [ ] **Step 4: Create AvailabilitySlotSeeder**

Per tenant: Mon-Fri 08:00-18:00, Sat 08:00-14:00, max_concurrent=2.

- [ ] **Step 5: Create ReservationSeeder**

20 reservations per tenant spread over last 7 days, mixed statuses (pending, confirmed, completed, cancelled).

- [ ] **Step 6: Create WashLogSeeder**

30 wash_logs per tenant over last 14 days, realistic prices, mixed payment methods.

- [ ] **Step 7: Wire up DatabaseSeeder and run**

```bash
php artisan migrate:fresh --seed
```

- [ ] **Step 8: Commit**

```bash
git add database/seeders/
git commit -m "feat(fase-1): realistic seeders for dev environment"
```

---

### Task 16: Integration tests — full API flow

**Files:**
- Create: `tests/Feature/Auth/AuthTest.php`
- Create: `tests/Feature/Reservation/ReservationApiTest.php`
- Create: `tests/Feature/WashLog/WashLogApiTest.php`
- Create: `tests/Feature/Vehicle/VehicleApiTest.php`
- Create: `tests/Feature/Service/ServiceApiTest.php`

- [ ] **Step 1: Write auth flow tests**

Register user, login, get token, use token for authenticated requests, logout.

- [ ] **Step 2: Write reservation API tests**

Create reservation via API, confirm, start, complete. Test conflict detection. Test available slots endpoint.

- [ ] **Step 3: Write wash log API tests**

Create walk-in, complete, get daily summary. Verify tenant isolation (tenant A can't see tenant B's logs).

- [ ] **Step 4: Write vehicle + service tests**

CRUD operations, unique plate constraint, vehicle history.

- [ ] **Step 5: Run full test suite**

```bash
./vendor/bin/pest --parallel
```

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "feat(fase-1): integration tests for all API endpoints"
```
