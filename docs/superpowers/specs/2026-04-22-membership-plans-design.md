# Membership Plans System — Design Spec

**Date:** 2026-04-22
**Scope:** CRUD de planes desde SuperAdmin + enforcement de límites por plan
**Phase:** B (sin pasarela de pago, cobro manual, asignación manual desde SuperAdmin)

---

## 1. Database

### New table: `plans`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(100) | "Gratis", "Básico", "Pro", "Premium" |
| slug | VARCHAR(100) UNIQUE | "free", "basic", "pro", "premium" |
| price | DECIMAL(8,2) | 0.00, 9.99, 19.99, 29.99 |
| max_services | INT NULL | null = unlimited |
| max_reservations_per_month | INT NULL | null = unlimited |
| max_employees | INT NULL | null = unlimited |
| has_push_notifications | BOOL DEFAULT false | |
| has_reports | BOOL DEFAULT false | |
| has_reminders | BOOL DEFAULT false | |
| has_custom_page | BOOL DEFAULT false | |
| is_active | BOOL DEFAULT true | |
| sort_order | INT DEFAULT 0 | |
| description | TEXT NULL | Short description for UI |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP NULL | Soft deletes |

### Changes to `tenants`

- **Remove:** `plan` enum column (`trial`, `basic`, `pro`)
- **Add:** `plan_id` UUID NULL FK → `plans(id)`
- **Add:** `is_trial` BOOL DEFAULT false
- **Keep:** `trial_ends_at` (already exists)

### Data migration

| Old `plan` value | New state |
|------------------|-----------|
| `trial` | `is_trial=true`, `plan_id=null` |
| `basic` | `is_trial=false`, `plan_id=` Básico plan UUID |
| `pro` | `is_trial=false`, `plan_id=` Pro plan UUID |

### Default plans seeder

| | Free | Básico | Pro | Premium |
|---|---|---|---|---|
| price | $0.00 | $9.99 | $19.99 | $29.99 |
| max_services | 1 | 5 | null | null |
| max_reservations_per_month | 30 | null | null | null |
| max_employees | 0 | 1 | null | null |
| has_push_notifications | false | true | true | true |
| has_reports | false | false | true | true |
| has_reminders | false | false | true | true |
| has_custom_page | false | false | false | true |

---

## 2. Backend — Domain Layer

### Entity: `Plan`

```php
final readonly class Plan {
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

Location: `app/Domain/Plan/Entities/Plan.php`

### Repository Interface: `PlanRepositoryInterface`

```php
interface PlanRepositoryInterface {
    public function findById(string $id): ?Plan;
    public function findBySlug(string $slug): ?Plan;
    public function all(): array;
    public function save(Plan $plan): Plan;
    public function delete(string $id): void;
}
```

Location: `app/Domain/Plan/Contracts/PlanRepositoryInterface.php`

### Changes to Tenant entity

Add properties:
- `public ?string $planId`
- `public bool $isTrial`

Methods:
- `hasPlan(): bool` — `$this->planId !== null`
- `isOnTrial(): bool` — `$this->isTrial && !$this->isTrialExpired()`

---

## 3. Backend — Application Layer

### Use Cases

| Use Case | Location |
|----------|----------|
| `CreatePlanUseCase` | `app/Application/UseCases/Plan/` |
| `UpdatePlanUseCase` | `app/Application/UseCases/Plan/` |
| `DeletePlanUseCase` | `app/Application/UseCases/Plan/` |
| `GetAllPlansUseCase` | `app/Application/UseCases/Plan/` |
| `AssignPlanToTenantUseCase` | `app/Application/UseCases/Tenant/` |

### DTOs

- `CreatePlanDTO` — all plan fields
- `UpdatePlanDTO` — all plan fields (partial update)
- `AssignPlanDTO` — `tenantId`, `planId`

### PlanLimitsService

Location: `app/Application/Services/PlanLimitsService.php`

```php
class PlanLimitsService {
    public function canCreateService(string $tenantId): bool
    public function canCreateReservation(string $tenantId): bool
    public function canAddEmployee(string $tenantId): bool
    public function hasFeature(string $tenantId, string $feature): bool
}
```

Logic:
- Get tenant → get plan
- If tenant has no plan and is not on active trial → return false
- If on trial → allow everything (trial = full access for 14 days)
- If limit is null → return true (unlimited)
- Count current resources → compare with limit

---

## 4. Backend — Infrastructure Layer

### API Routes (SuperAdmin)

```
GET    /v1/superadmin/plans                    → PlanController@index
POST   /v1/superadmin/plans                    → PlanController@store
PATCH  /v1/superadmin/plans/{id}               → PlanController@update
DELETE /v1/superadmin/plans/{id}               → PlanController@destroy
POST   /v1/superadmin/tenants/{id}/assign-plan → SuperAdminController@assignPlan
```

### Enforcement injection points

| Controller | Method | Check |
|-----------|--------|-------|
| ServiceController | store | `canCreateService()` |
| ReservationController | store | `canCreateReservation()` |
| EmployeeController (or equivalent) | store | `canAddEmployee()` |
| Push notification logic | send | `hasFeature('push_notifications')` |

Response on limit hit: `403 { "error": "Plan limit reached", "limit": "max_services" }`

### Artisan Command: `plan:check-trials`

- Find tenants where `is_trial=true` AND `trial_ends_at < now()`
- Set `status='suspended'`
- Run daily via scheduler

### Eloquent Repository, Model, Resource, FormRequests

Follow exact patterns from `BusinessCategoryController` and `EloquentTenantRepository`.

---

## 5. Frontend — SuperAdmin UI (Next.js)

### New page: `(super-admin)/plans/page.tsx`

**Table view:**
- Columns: name, price, limits summary, features (icons), status, actions
- Actions: edit (dialog), toggle active, delete

**Create/Edit dialog:**
- Fields: name, price, description
- Numeric limits: max services, max reservations/month, max employees (empty = unlimited)
- Boolean features: push, reports, reminders, custom page (toggle switches)
- Sort order, active toggle

### Changes to tenants page

- Plan column shows current plan name (or "Trial — X days left")
- New action: "Assign plan" → select dropdown with active plans
- Badge colors: trial (yellow), free (gray), basic (blue), pro (green), premium (purple)

### Architecture layers

```
domain/entities/plan.ts
domain/repositories/super-admin.repository.ts  (add plan methods)
infrastructure/api/mappers/plan.mapper.ts
infrastructure/api/repositories/api-super-admin.repository.ts  (add plan methods)
presentation/hooks/use-plans.ts
presentation/app/(super-admin)/plans/page.tsx
```

---

## 6. Out of Scope (Phase 2+)

- Payment gateway (PayPhone) integration
- Self-service upgrade/downgrade from tenant admin
- Billing history / invoices
- Soft warnings at 80% usage
- Usage analytics dashboard
- "Destacados" ad system
