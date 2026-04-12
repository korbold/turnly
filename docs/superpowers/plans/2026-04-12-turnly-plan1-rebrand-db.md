# Plan 1: Rebranding + Database Migrations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand WashFlow → Turnly across entire codebase and restructure database for multi-business support.

**Architecture:** Find-and-replace branding in all UI text and code references. Create new migrations to add business_type/custom_fields/brand_theme/profile columns to tenants, rename vehicles→client_resources, rename wash_logs→service_logs, rename reservations.vehicle_id→client_resource_id. Add tenant_images and services.image_url.

**Tech Stack:** Laravel (PHP), Next.js (TypeScript), Flutter (Dart), MySQL

**Spec:** `docs/superpowers/specs/2026-04-12-turnly-rebrand-design.md`

**Depends on:** Nothing (this is the foundation)

**Subsequent plans depend on this:**
- Plan 2: Dynamic fields + Onboarding
- Plan 3: Business profiles + Media uploads
- Plan 4: Public page + Booking flow
- Plan 5: Super admin panel

---

## Task 1: Rebrand backend — APP_NAME and seeders

**Files:**
- Modify: `apps/backend/.env` (APP_NAME)
- Modify: `apps/backend/.env.example` (APP_NAME)
- Modify: `apps/backend/database/seeders/UserSeeder.php` (emails, slugs)
- Modify: `apps/backend/database/seeders/TenantSeeder.php` (emails, slugs)

- [ ] **Step 1: Update .env APP_NAME**

```
APP_NAME=Turnly
```

- [ ] **Step 2: Update .env.example APP_NAME**

```
APP_NAME=Turnly
```

- [ ] **Step 3: Update UserSeeder.php**

Replace all `@washflow.com` email references with `@turnly.com`. Replace `super@washflow.com` with `super@turnly.com`. Replace `lavadora-lopez` slug references with `barber-demo`. Replace `auto-spa-centro` with `spa-demo`.

- [ ] **Step 4: Update TenantSeeder.php**

Replace tenant names and slugs from car-wash-specific to generic demo businesses. Replace `@washflow.com` emails with `@turnly.com`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/.env apps/backend/.env.example apps/backend/database/seeders/UserSeeder.php apps/backend/database/seeders/TenantSeeder.php
git commit -m "rebrand: update backend app name and seeders to Turnly"
```

---

## Task 2: Rebrand admin panel — all UI text

**Files:**
- Modify: `apps/admin/src/app/layout.tsx` (meta title)
- Modify: `apps/admin/src/app/(auth)/layout.tsx` (heading, description)
- Modify: `apps/admin/src/app/(onboarding)/layout.tsx` (heading)
- Modify: `apps/admin/src/app/(onboarding)/welcome/page.tsx` (domain ref)
- Modify: `apps/admin/src/components/layout/Sidebar.tsx` (brand text)
- Modify: `apps/admin/src/components/layout/MobileSidebar.tsx` (brand text)
- Modify: `apps/admin/src/app/(tenant)/services/page.tsx` (lavado text)
- Modify: `apps/admin/src/app/(tenant)/dashboard/page.tsx` (lavado text)
- Modify: `apps/admin/src/app/(tenant)/reports/page.tsx` (lavado text)
- Modify: `apps/admin/src/app/(tenant)/wash-log/page.tsx` (lavado text)
- Modify: `apps/admin/src/app/(tenant)/wash-log/new/page.tsx` (lavado text)
- Modify: `apps/admin/src/app/(tenant)/vehicles/[id]/page.tsx` (lavado text)
- Modify: `apps/admin/src/components/wash-log/WalkInForm.tsx` (lavado text)
- Modify: `apps/admin/src/components/wash-log/DailySummaryCard.tsx` (lavado text)
- Modify: `apps/admin/src/components/wash-log/DailyLogTable.tsx` (lavado text)
- Modify: `apps/admin/src/app/(onboarding)/configure/page.tsx` (lavado text)

- [ ] **Step 1: Update layout files**

In `apps/admin/src/app/layout.tsx`:
- Change title from `"CarWash Admin"` to `"Turnly"`
- Change description from car wash text to `"Gestión de citas y servicios"`

In `apps/admin/src/app/(auth)/layout.tsx`:
- Change `"WashFlow"` to `"Turnly"`
- Change `"Gestión de lavado de autos"` to `"Gestión de citas y servicios"`

In `apps/admin/src/app/(onboarding)/layout.tsx`:
- Change `"WashFlow"` to `"Turnly"`
- Change `"Configura tu negocio"` stays (already generic)

- [ ] **Step 2: Update sidebar and navigation**

In `apps/admin/src/components/layout/Sidebar.tsx`:
- Change `"WashFlow"` to `"Turnly"`
- Change `"Panel de administración"` stays (already generic)
- Change `{ href: '/vehicles', label: 'Vehículos', icon: Car }` to `{ href: '/clients', label: 'Clientes', icon: Users }`
- Change `{ href: '/wash-log', label: 'Libro Diario', icon: BookOpen }` to `{ href: '/service-log', label: 'Registro del día', icon: BookOpen }`
- Update imports: replace `Car` with `Users` from lucide-react (keep existing `Users` import for team, use `UserCircle` or `Contact` for clients)

In `apps/admin/src/components/layout/MobileSidebar.tsx`:
- Same changes as Sidebar.tsx

- [ ] **Step 3: Update welcome page**

In `apps/admin/src/app/(onboarding)/welcome/page.tsx`:
- Change `"{slug}.washflow.com"` to `"{slug}.turnly.app"`
- Change `"lavadero de autos"` to `"negocio"`

- [ ] **Step 4: Replace "lavado" text in tenant pages**

In all files listed above, replace:
- `"servicios de lavado"` → `"servicios"`
- `"Registrar lavado"` → `"Registrar servicio"`
- `"Total lavados"` → `"Total servicios"`
- `"Autos lavados"` → `"Servicios realizados"`
- `"registro de lavados"` → `"registro de servicios"`
- `"historial de lavados"` → `"historial de servicios"`
- `"no hay lavados"` → `"no hay registros"`
- `"Registro de lavados"` → `"Registro del día"`

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/
git commit -m "rebrand: update all admin panel text WashFlow → Turnly, lavado → servicios"
```

---

## Task 3: Rebrand staff Flutter app

**Files:**
- Modify: `apps/staff/pubspec.yaml` (name)
- Modify: `apps/staff/lib/main.dart` (app name, class name)
- Modify: `apps/staff/lib/features/auth/presentation/screens/login_screen.dart` (title, icon, placeholder)
- Modify: `apps/staff/lib/features/dashboard/presentation/screens/dashboard_screen.dart` (lavado text)
- Modify: `apps/staff/lib/features/reports/presentation/screens/reports_screen.dart` (lavado text, icons)
- Modify: `apps/staff/lib/features/wash_log/presentation/screens/wash_log_screen.dart` (lavado text)
- Modify: `apps/staff/lib/features/wash_log/presentation/screens/register_wash_screen.dart` (lavado text)
- Modify: `apps/staff/lib/features/reservations/presentation/widgets/reservation_card.dart` (icon)
- Modify: `apps/staff/lib/features/reservations/presentation/screens/reservation_detail_screen.dart` (icon)
- Modify: `apps/staff/android/app/src/main/AndroidManifest.xml` (label)
- Modify: `apps/staff/ios/Runner/Info.plist` (bundle name)

- [ ] **Step 1: Update pubspec.yaml and main.dart**

In `pubspec.yaml`: change `name: washflow_staff` to `name: turnly_staff`

In `main.dart`:
- Rename `WashFlowStaffApp` class to `TurnlyStaffApp`
- Change app title to `'Turnly Staff'`

- [ ] **Step 2: Update login screen**

- Change `'WashFlow'` title to `'Turnly'`
- Change `Icons.local_car_wash` to `Icons.calendar_month`
- Change placeholder `'ej: lavadora-lopez'` to `'ej: mi-negocio'`

- [ ] **Step 3: Update dashboard and reports**

- Replace `"Registrar lavado"` → `"Registrar servicio"`
- Replace `"Total lavados"` → `"Total servicios"`
- Replace `Icons.local_car_wash` → `Icons.event_available` (or similar generic icon)

- [ ] **Step 4: Update wash_log screens**

- Replace all `"lavado"` text references with `"servicio"` equivalents
- Replace car wash specific icons with generic service icons

- [ ] **Step 5: Update Android and iOS config**

In `AndroidManifest.xml`: change `android:label` to `"Turnly Staff"`
In `Info.plist`: change bundle name to `"Turnly Staff"`

- [ ] **Step 6: Commit**

```bash
git add apps/staff/
git commit -m "rebrand: update staff Flutter app WashFlow → Turnly"
```

---

## Task 4: Rebrand mobile Flutter app

**Files:**
- Modify: `apps/mobile/pubspec.yaml` (name)
- Modify: `apps/mobile/lib/main.dart` (app name, class name)
- Modify: `apps/mobile/lib/features/auth/presentation/screens/login_screen.dart` (title)
- Modify: `apps/mobile/lib/features/auth/presentation/screens/register_screen.dart` (title)
- Modify: `apps/mobile/lib/features/home/presentation/screens/home_screen.dart` (appBar title)
- Modify: `apps/mobile/lib/features/vehicles/presentation/screens/vehicle_history_screen.dart` (lavado text)
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml` (label)
- Modify: `apps/mobile/ios/Runner/Info.plist` (bundle name)
- Modify: `apps/mobile/android/app/build.gradle.kts` (namespace, applicationId)

- [ ] **Step 1: Update pubspec.yaml and main.dart**

In `pubspec.yaml`: change `name: washflow_mobile` to `name: turnly_mobile`

In `main.dart`:
- Rename `WashFlowApp` class to `TurnlyApp`
- Change app title to `'Turnly'`

- [ ] **Step 2: Update auth and home screens**

- Change all `'WashFlow'` title references to `'Turnly'`
- Change `"historial de lavados"` to `"historial de servicios"`

- [ ] **Step 3: Update Android and iOS config**

In `AndroidManifest.xml`: change `android:label` to `"Turnly"`
In `Info.plist`: change bundle name to `"Turnly"`
In `build.gradle.kts`: change namespace and applicationId from `com.washflow.washflow_mobile` to `com.turnly.turnly_mobile`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "rebrand: update mobile Flutter app WashFlow → Turnly"
```

---

## Task 5: Rebrand documentation and config

**Files:**
- Modify: `README.md`
- Modify: `docker-compose.yml`
- Modify: `docs/architecture.md`
- Modify: `docs/api.md`

- [ ] **Step 1: Update README.md**

Change `# WashFlow` to `# Turnly` and update description from car wash to generic appointment platform.

- [ ] **Step 2: Update docker-compose.yml**

Change `MYSQL_DATABASE: washflow` to `MYSQL_DATABASE: turnly`
Change `MYSQL_USER: washflow` to `MYSQL_USER: turnly`

Note: The local dev .env DB name stays as-is for now since the DB already exists. This change only affects fresh Docker setups.

- [ ] **Step 3: Update docs**

In `docs/architecture.md`: Change `# WashFlow Architecture` to `# Turnly Architecture`
In `docs/api.md`: Change `# WashFlow API` to `# Turnly API`

- [ ] **Step 4: Commit**

```bash
git add README.md docker-compose.yml docs/architecture.md docs/api.md
git commit -m "rebrand: update docs and config WashFlow → Turnly"
```

---

## Task 6: Migration — add business_type, profile columns, brand_theme to tenants

**Files:**
- Create: `apps/backend/database/migrations/2026_04_12_140000_add_business_profile_to_tenants_table.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/TenantModel.php` (fillable, casts)

- [ ] **Step 1: Create migration**

```bash
cd apps/backend && php artisan make:migration add_business_profile_to_tenants_table
```

- [ ] **Step 2: Write migration content**

```php
public function up(): void
{
    Schema::table('tenants', function (Blueprint $table) {
        $table->enum('business_type', ['car_wash', 'barbershop', 'medical', 'spa', 'gym', 'other'])
            ->default('other')->after('country');
        $table->json('custom_fields')->nullable()->after('business_type');
        $table->text('description')->nullable()->after('name');
        $table->string('address', 255)->nullable()->after('phone');
        $table->string('logo_url', 500)->nullable()->after('settings');
        $table->string('cover_url', 500)->nullable()->after('logo_url');
        $table->json('social_links')->nullable()->after('cover_url');
        $table->string('brand_theme', 20)->default('blue')->after('social_links');
    });
}

public function down(): void
{
    Schema::table('tenants', function (Blueprint $table) {
        $table->dropColumn([
            'business_type', 'custom_fields', 'description', 'address',
            'logo_url', 'cover_url', 'social_links', 'brand_theme',
        ]);
    });
}
```

- [ ] **Step 3: Update TenantModel fillable and casts**

Add to `$fillable`:
```php
'business_type', 'custom_fields', 'description', 'address',
'logo_url', 'cover_url', 'social_links', 'brand_theme',
```

Add to `casts()`:
```php
'custom_fields' => 'array',
'social_links' => 'array',
```

- [ ] **Step 4: Run migration**

```bash
php artisan migrate
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/database/migrations/ apps/backend/app/Infrastructure/Persistence/Models/TenantModel.php
git commit -m "feat: add business profile columns to tenants table"
```

---

## Task 7: Migration — create tenant_images table

**Files:**
- Create: `apps/backend/database/migrations/2026_04_12_140100_create_tenant_images_table.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/TenantImageModel.php`

- [ ] **Step 1: Create migration**

```bash
php artisan make:migration create_tenant_images_table
```

- [ ] **Step 2: Write migration content**

```php
public function up(): void
{
    Schema::create('tenant_images', function (Blueprint $table) {
        $table->uuid('id')->primary();
        $table->uuid('tenant_id')->index();
        $table->string('url', 500);
        $table->string('caption', 255)->nullable();
        $table->integer('sort_order')->default(0);
        $table->timestamps();
        $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
    });
}

public function down(): void
{
    Schema::dropIfExists('tenant_images');
}
```

- [ ] **Step 3: Create TenantImageModel**

```php
<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TenantImageModel extends Model
{
    use HasUuids;

    protected $table = 'tenant_images';

    protected $fillable = ['tenant_id', 'url', 'caption', 'sort_order'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }
}
```

- [ ] **Step 4: Add relationship to TenantModel**

```php
public function images()
{
    return $this->hasMany(TenantImageModel::class, 'tenant_id')->orderBy('sort_order');
}
```

- [ ] **Step 5: Run migration and commit**

```bash
php artisan migrate
git add apps/backend/database/migrations/ apps/backend/app/Infrastructure/Persistence/Models/
git commit -m "feat: create tenant_images table and model"
```

---

## Task 8: Migration — add image_url to services

**Files:**
- Create: `apps/backend/database/migrations/2026_04_12_140200_add_image_url_to_services_table.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceModel.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ServiceResource.php`

- [ ] **Step 1: Create and write migration**

```bash
php artisan make:migration add_image_url_to_services_table
```

```php
public function up(): void
{
    Schema::table('services', function (Blueprint $table) {
        $table->string('image_url', 500)->nullable()->after('description');
    });
}

public function down(): void
{
    Schema::table('services', function (Blueprint $table) {
        $table->dropColumn('image_url');
    });
}
```

- [ ] **Step 2: Update ServiceModel**

Add `'image_url'` to `$fillable` array.

- [ ] **Step 3: Update ServiceResource**

Add `'image_url' => $this->image_url` to `toArray()`.

- [ ] **Step 4: Run migration and commit**

```bash
php artisan migrate
git add apps/backend/database/migrations/ apps/backend/app/Infrastructure/Persistence/Models/ServiceModel.php apps/backend/app/Infrastructure/Http/Resources/ServiceResource.php
git commit -m "feat: add image_url to services table"
```

---

## Task 9: Migration — rename vehicles to client_resources

**Files:**
- Create: `apps/backend/database/migrations/2026_04_12_140300_rename_vehicles_to_client_resources.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/VehicleModel.php` → rename to `ClientResourceModel.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/VehicleResource.php` → rename to `ClientResourceResource.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Vehicle/VehicleController.php` → rename to `ClientResource/ClientResourceController.php`
- Modify: `apps/backend/app/Infrastructure/Http/Requests/Vehicle/CreateVehicleRequest.php` → rename to `ClientResource/CreateClientResourceRequest.php`
- Modify: `apps/backend/app/Domain/Vehicle/` → rename to `Domain/ClientResource/`
- Modify: `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentVehicleRepository.php` → rename to `EloquentClientResourceRepository.php`
- Modify: `apps/backend/app/Application/UseCases/Vehicle/` → rename to `UseCases/ClientResource/`
- Modify: `apps/backend/app/Application/DTOs/Vehicle/` → rename to `DTOs/ClientResource/`
- Modify: `apps/backend/routes/api.php` (vehicle routes)
- Modify: `apps/backend/app/Infrastructure/Providers/RepositoryServiceProvider.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/UserModel.php` (vehicles relationship)
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ReservationModel.php` (vehicle_id)
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/WashLogModel.php` (vehicle_id)

- [ ] **Step 1: Create rename migration**

```php
public function up(): void
{
    Schema::rename('vehicles', 'client_resources');

    // Replace fixed columns with dynamic JSON
    Schema::table('client_resources', function (Blueprint $table) {
        $table->string('label', 255)->nullable()->after('owner_id');
        $table->json('data')->nullable()->after('label');
    });

    // Rename owner_id to client_id
    Schema::table('client_resources', function (Blueprint $table) {
        $table->renameColumn('owner_id', 'client_id');
    });

    // Rename vehicle_id in reservations and wash_logs
    Schema::table('reservations', function (Blueprint $table) {
        $table->renameColumn('vehicle_id', 'client_resource_id');
    });

    Schema::table('wash_logs', function (Blueprint $table) {
        $table->renameColumn('vehicle_id', 'client_resource_id');
    });
}

public function down(): void
{
    Schema::table('wash_logs', function (Blueprint $table) {
        $table->renameColumn('client_resource_id', 'vehicle_id');
    });

    Schema::table('reservations', function (Blueprint $table) {
        $table->renameColumn('client_resource_id', 'vehicle_id');
    });

    Schema::table('client_resources', function (Blueprint $table) {
        $table->renameColumn('client_id', 'owner_id');
    });

    Schema::table('client_resources', function (Blueprint $table) {
        $table->dropColumn(['label', 'data']);
    });

    Schema::rename('client_resources', 'vehicles');
}
```

- [ ] **Step 2: Rename backend PHP files and update namespaces**

Rename all Vehicle-related files to ClientResource equivalents. Update all class names, namespaces, and references:
- `VehicleModel` → `ClientResourceModel` (table: `client_resources`, update fillable to include `label`, `data`, replace `owner_id` with `client_id`)
- `VehicleController` → `ClientResourceController`
- `VehicleResource` → `ClientResourceResource`
- `CreateVehicleRequest` → `CreateClientResourceRequest`
- `VehicleRepositoryInterface` → `ClientResourceRepositoryInterface`
- `EloquentVehicleRepository` → `EloquentClientResourceRepository`
- `CreateVehicleUseCase` → `CreateClientResourceUseCase`
- `CreateVehicleDTO` → `CreateClientResourceDTO`
- `GetVehicleHistoryUseCase` → `GetClientResourceHistoryUseCase`
- `Vehicle` (entity) → `ClientResource`

- [ ] **Step 3: Update relationships in other models**

In `UserModel.php`: rename `vehicles()` to `clientResources()`, update class reference.
In `ReservationModel.php`: rename `vehicle()` to `clientResource()`, change `vehicle_id` to `client_resource_id`.
In `WashLogModel.php`: rename `vehicle()` to `clientResource()`, change `vehicle_id` to `client_resource_id`.

- [ ] **Step 4: Update routes**

In `routes/api.php`: change `vehicles` routes to `client-resources`, update controller reference.

- [ ] **Step 5: Update RepositoryServiceProvider**

Update Vehicle interface/implementation bindings to ClientResource equivalents.

- [ ] **Step 6: Run migration and commit**

```bash
php artisan migrate
git add apps/backend/
git commit -m "feat: rename vehicles to client_resources with dynamic fields"
```

---

## Task 10: Migration — rename wash_logs to service_logs

**Files:**
- Create: `apps/backend/database/migrations/2026_04_12_140400_rename_wash_logs_to_service_logs.php`
- Rename all backend WashLog files to ServiceLog equivalents (same pattern as Task 9)
- Modify: `apps/backend/routes/api.php`
- Modify: `apps/backend/app/Infrastructure/Providers/RepositoryServiceProvider.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php`

- [ ] **Step 1: Create rename migration**

```php
public function up(): void
{
    Schema::rename('wash_logs', 'service_logs');
}

public function down(): void
{
    Schema::rename('service_logs', 'wash_logs');
}
```

- [ ] **Step 2: Rename all backend PHP files**

Same pattern as Task 9:
- `WashLogModel` → `ServiceLogModel` (table: `service_logs`)
- `WashLogController` → `ServiceLogController`
- `WashLogResource` → `ServiceLogResource`
- `CreateWashLogRequest` → `CreateServiceLogRequest`
- `WashLogRepositoryInterface` → `ServiceLogRepositoryInterface`
- `EloquentWashLogRepository` → `EloquentServiceLogRepository`
- `CreateWashLogUseCase` → `CreateServiceLogUseCase`
- `UpdateWashLogUseCase` → `UpdateServiceLogUseCase`
- `GetDailyLogUseCase` stays (already generic name)
- `CreateWashLogDTO` → `CreateServiceLogDTO`
- `UpdateWashLogDTO` → `UpdateServiceLogDTO`
- `WashLog` (entity) → `ServiceLog`
- `WashLogNotFoundException` → `ServiceLogNotFoundException`

- [ ] **Step 3: Update routes**

In `routes/api.php`: change `wash-logs` routes to `service-logs`, update controller reference.

- [ ] **Step 4: Update RepositoryServiceProvider and ReportController**

Update bindings and references from WashLog to ServiceLog.

- [ ] **Step 5: Run migration and commit**

```bash
php artisan migrate
git add apps/backend/
git commit -m "feat: rename wash_logs to service_logs"
```

---

## Task 11: Update admin frontend — vehicles → clients, wash-log → service-log

**Files:**
- Rename: `apps/admin/src/types/vehicle.ts` → `client-resource.ts`
- Rename: `apps/admin/src/types/wash-log.ts` → `service-log.ts`
- Rename: `apps/admin/src/lib/api/vehicles.ts` → `client-resources.ts`
- Rename: `apps/admin/src/lib/api/wash-log.ts` → `service-log.ts`
- Rename: `apps/admin/src/app/(tenant)/vehicles/` → `clients/`
- Rename: `apps/admin/src/app/(tenant)/wash-log/` → `service-log/`
- Rename: `apps/admin/src/components/wash-log/` → `service-log/`
- Update: all imports and references in reservation pages, dashboard, reports
- Update: `apps/admin/src/types/reservation.ts` (vehicle → client_resource)

- [ ] **Step 1: Rename type files and update contents**

Create `client-resource.ts` with updated interface (id, tenant_id, client_id, label, data as Record<string,unknown>).
Create `service-log.ts` replacing all WashLog references with ServiceLog, vehicle_id with client_resource_id.

- [ ] **Step 2: Rename API files and update endpoints**

Create `client-resources.ts` calling `/client-resources` instead of `/vehicles`.
Create `service-log.ts` calling `/service-logs` instead of `/wash-logs`.

- [ ] **Step 3: Rename page directories**

Move `vehicles/` → `clients/`, `wash-log/` → `service-log/`
Update all component imports.

- [ ] **Step 4: Rename component directory**

Move `components/wash-log/` → `components/service-log/`
Rename files: `WalkInForm` → `WalkInForm` (keep name, update imports), `DailyLogTable` → `DailyLogTable`, `DailySummaryCard` → `DailySummaryCard`.
Update all internal references from vehicle/washLog to clientResource/serviceLog.

- [ ] **Step 5: Update reservation and dashboard references**

Update `types/reservation.ts`: `vehicle_id` → `client_resource_id`, vehicle object → client_resource object.
Update all components that reference vehicles or wash-logs to use new paths and types.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/
git commit -m "rebrand: rename vehicles→clients, wash-log→service-log in admin"
```

---

## Task 12: Update staff Flutter app — vehicles and wash_log references

**Files:**
- Rename: `apps/staff/lib/features/wash_log/` → `service_log/`
- Update: all wash_log entity, DTO, repository, screens to service_log
- Update: vehicle references in reservation DTOs and screens
- Update: router, shell screen, dashboard references

- [ ] **Step 1: Rename wash_log feature to service_log**

Rename directory `features/wash_log/` → `features/service_log/`.
Rename all classes: `WashLog` → `ServiceLog`, `WashLogDto` → `ServiceLogDto`, etc.
Update API endpoints from `/wash-logs` to `/service-logs`.

- [ ] **Step 2: Update vehicle references**

In reservation entity/DTO: `vehicleId` → `clientResourceId`, vehicle object properties to generic label/data.
In reservation screens: replace vehicle-specific display with generic client resource display.
In service_log screens: `vehicleId` → `clientResourceId`.

- [ ] **Step 3: Update router and navigation**

Update `app_router.dart`: wash_log routes → service_log routes.
Update `shell_screen.dart`: navigation references.
Update `dashboard_screen.dart`: references.

- [ ] **Step 4: Commit**

```bash
git add apps/staff/lib/
git commit -m "rebrand: rename wash_log→service_log, vehicle→client_resource in staff app"
```

---

## Task 13: Update mobile Flutter app — vehicles and reservations

**Files:**
- Update: `apps/mobile/lib/features/vehicles/` → rename to `client_resources/`
- Update: all vehicle entity, repository, screens
- Update: reservation references to vehicle
- Update: router

- [ ] **Step 1: Rename vehicles feature to client_resources**

Rename directory and all classes. Update API endpoints from `/vehicles` to `/client-resources`.
Update entity from fixed fields (plate, brand, model) to dynamic fields (label, data).

- [ ] **Step 2: Update reservation references**

In reservation entity/DTO: `vehicleId` → `clientResourceId`.
In reservation screens: replace vehicle selection with client resource selection.
In create reservation flow: adapt vehicle step to generic resource step.

- [ ] **Step 3: Update router**

Update `app_router.dart`: vehicle routes → client_resource routes.
Update home screen navigation.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/
git commit -m "rebrand: rename vehicles→client_resources in mobile app"
```

---

## Task 14: Update backend tests

**Files:**
- Rename: `apps/backend/tests/Feature/Vehicle/VehicleTest.php` → `ClientResource/ClientResourceTest.php`
- Rename: `apps/backend/tests/Feature/WashLog/WashLogTest.php` → `ServiceLog/ServiceLogTest.php`
- Update: `apps/backend/tests/Feature/Reservation/ReservationTest.php` (vehicle_id references)
- Update: `apps/backend/database/factories/VehicleModelFactory.php` → `ClientResourceModelFactory.php`
- Update: `apps/backend/database/factories/WashLogModelFactory.php` → `ServiceLogModelFactory.php`
- Update: `apps/backend/database/factories/ReservationModelFactory.php` (vehicle_id)

- [ ] **Step 1: Rename and update test files**

Rename test files and update all class references, route paths (`/vehicles` → `/client-resources`, `/wash-logs` → `/service-logs`), and field names (`vehicle_id` → `client_resource_id`).

- [ ] **Step 2: Rename and update factories**

`VehicleModelFactory` → `ClientResourceModelFactory`: update model reference, replace fixed fields with `label` and `data` JSON.
`WashLogModelFactory` → `ServiceLogModelFactory`: update model and field references.
`ReservationModelFactory`: update `vehicle_id` → `client_resource_id`.

- [ ] **Step 3: Run tests**

```bash
php artisan test
```

Fix any failures.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/tests/ apps/backend/database/factories/
git commit -m "rebrand: update tests and factories for client_resources and service_logs"
```

---

## Task 15: Update TenantResource to include new profile fields

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Resources/TenantResource.php`

- [ ] **Step 1: Update TenantResource toArray**

Add all new profile fields to the response:

```php
'business_type' => $this->business_type,
'custom_fields' => $this->custom_fields,
'description' => $this->description,
'address' => $this->address,
'logo_url' => $this->logo_url,
'cover_url' => $this->cover_url,
'social_links' => $this->social_links,
'brand_theme' => $this->brand_theme,
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Resources/TenantResource.php
git commit -m "feat: include business profile fields in TenantResource"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run backend tests**

```bash
cd apps/backend && php artisan test
```

- [ ] **Step 2: Verify admin builds**

```bash
cd apps/admin && npm run build
```

- [ ] **Step 3: Verify no remaining old references**

```bash
grep -r "WashFlow\|washflow\|wash_log\|WashLog\|VehicleModel\|vehicle_id" apps/backend/app/ apps/admin/src/ --include="*.php" --include="*.ts" --include="*.tsx" -l
```

Should return empty (only docs/specs may still reference old names, which is fine).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "rebrand: final cleanup and verification"
```
