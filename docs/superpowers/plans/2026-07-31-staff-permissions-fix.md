# Staff Permissions Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cashier/washer staff see a usable app by fixing the tenant-permissions round-trip (backend persist + return) and adding a sensible per-role default baseline as the frontend fallback.

**Architecture:** Backend `TenantSettingsController::update` persists a top-level `permissions` matrix into the tenant `settings` JSON; `TenantResource` returns it. Frontend gains a shared `DEFAULT_PERMISSIONS` baseline consumed as a fallback in `use-permissions.ts` and as the initial grid in `permissions-tab.tsx`, so unconfigured restricted roles get sensible access and owners can customize.

**Tech Stack:** Laravel (PHP, Pest, SQLite in-memory, sync queue), Next.js 16 admin (TypeScript — NO JS test runner; `tsc --noEmit` is the only frontend check).

## Global Constraints

- Feature tests live in `apps/backend/tests/Feature/`; they auto-apply `TestCase` + `RefreshDatabase` via `tests/Pest.php` — do NOT add `uses()`. Tenant↔user rows via `TenantUserModel::create([...])`. Tenant context set inline via `app()->instance('current_tenant', $tenant)` + `app()->instance('current_tenant_id', $tenant->id)`, and requests use `->actingAs($user)->withHeader('X-Tenant', $tenant->slug)`.
- `$tenant->settings` is already cast to a PHP array by the model (no manual `json_decode`).
- The permissions matrix is keyed by DISPLAY role names `Admin | Cajero | Lavador | Cliente` × sections `Dashboard | Reservas | Registro | Clientes | Servicios | Equipo | Reportes | Config`. Cell values are `'full' | 'view' | 'none'`. These key names are already consistent across `use-permissions.ts`, `permissions-tab.tsx`, and this plan — do NOT rename them.
- The default baseline is EXACTLY (source of truth — copy verbatim):
  - Admin: every section `full`
  - Cajero: Dashboard `view`, Reservas `full`, Registro `full`, Clientes `full`, Servicios `view`, Equipo `none`, Reportes `none`, Config `none`
  - Lavador: Dashboard `view`, Reservas `view`, Registro `full`, Clientes `none`, Servicios `none`, Equipo `none`, Reportes `none`, Config `none`
  - Cliente: every section `none`
- Empty permissions must serialize as a JSON object `{}` (not `[]`) — use `(object) []`.
- Run backend tests from `apps/backend/`: `./vendor/bin/pest <path>`. Run frontend check from `apps/admin-v2/`: `npx tsc --noEmit`.
- OUT OF SCOPE (do not touch): backend per-route permission enforcement; `ResolveTenantMiddleware` membership check; `AuthController::login` tenant selection. These are documented follow-ups.

---

### Task 1: Backend — persist and return the `permissions` matrix

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php` (validation ~line 43; settings-merge block ~line 92)
- Modify: `apps/backend/app/Infrastructure/Http/Resources/TenantResource.php` (`toArray`, after line 47)
- Test: `apps/backend/tests/Feature/Tenant/TenantSettingsPermissionsTest.php`

**Interfaces:**
- Produces: `PATCH /api/v1/tenant/settings` accepts a top-level `permissions` object and persists it under `settings.permissions`; `GET`/`PATCH` responses (`TenantResource`) include a `permissions` key (object; `{}` when unset).

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Tenant/TenantSettingsPermissionsTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function settingsOwner(TenantModel $tenant): UserModel
{
    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);
    return $owner;
}

test('PATCH tenant settings persists the permissions matrix and returns it', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);
    $owner = settingsOwner($tenant);

    $matrix = [
        'Cajero' => ['Reservas' => 'full', 'Clientes' => 'view', 'Config' => 'none'],
    ];

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson('/api/v1/tenant/settings', ['permissions' => $matrix])
        ->assertOk()
        ->assertJsonPath('data.permissions.Cajero.Reservas', 'full')
        ->assertJsonPath('data.permissions.Cajero.Clientes', 'view');

    // Round-trip: GET returns the persisted matrix
    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk()
        ->assertJsonPath('data.permissions.Cajero.Reservas', 'full');

    expect($tenant->fresh()->settings['permissions']['Cajero']['Reservas'])->toBe('full');
});

test('saving permissions does not clobber other settings', function () {
    $tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'settings' => ['iva_mode' => 'included'],
    ]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);
    $owner = settingsOwner($tenant);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson('/api/v1/tenant/settings', ['permissions' => ['Cajero' => ['Reservas' => 'full']]])
        ->assertOk()
        ->assertJsonPath('data.iva_mode', 'included')
        ->assertJsonPath('data.permissions.Cajero.Reservas', 'full');
});

test('tenant settings response includes a permissions key when unset', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);
    $owner = settingsOwner($tenant);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk()
        ->assertJsonStructure(['data' => ['permissions']]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Tenant/TenantSettingsPermissionsTest.php`
Expected: FAIL — no `permissions` persisted/returned (assertJsonPath on `data.permissions.*` missing).

- [ ] **Step 3: Persist `permissions` in the controller**

In `apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php`:

(a) Add a validation rule. After the `'iva_mode' => 'sometimes|string|in:excluded,included,zero',` line (line 43), add:
```php
            'permissions' => 'sometimes|array',
```

(b) In the settings-merge block, immediately AFTER the `iva_mode` block (after line 92, the closing `}` of `if ($request->has('iva_mode'))`) and BEFORE the generic `if ($request->has('settings'))` merge (line 93), add:
```php
        if ($request->has('permissions')) {
            $settings['permissions'] = $request->input('permissions');
        }
```

- [ ] **Step 4: Return `permissions` in the resource**

In `apps/backend/app/Infrastructure/Http/Resources/TenantResource.php::toArray`, after the `'iva_mode' => $this->settings['iva_mode'] ?? 'excluded',` line (line 47), add:
```php
            'permissions'         => $this->settings['permissions'] ?? (object) [],
```

- [ ] **Step 5: Confirm `show()` returns `TenantResource`**

Open `TenantSettingsController.php` and verify the `show()` method (backing `GET /tenant/settings`) returns `new TenantResource(...)` (same resource as `update`). If it builds its own array instead, add the same `'permissions' => $settings['permissions'] ?? (object) []` key there too so the GET round-trip test passes. (Quote what you find in the report.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Tenant/TenantSettingsPermissionsTest.php`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the tenant suite for regression**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Tenant/`
Expected: PASS (includes LockedCustomFields + the new permissions tests).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php \
        apps/backend/app/Infrastructure/Http/Resources/TenantResource.php \
        apps/backend/tests/Feature/Tenant/TenantSettingsPermissionsTest.php
git commit -m "fix(tenant): persist and return the staff permissions matrix"
```

---

### Task 2: Frontend — shared default baseline + resolver fallback

**Files:**
- Create: `apps/admin-v2/src/shared/constants/permissions.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-permissions.ts` (line 55 resolution)
- Modify: `apps/admin-v2/src/presentation/components/features/settings/permissions-tab.tsx` (`buildDefaultMatrix`, line 50)

**Interfaces:**
- Consumes: backend now returns `permissions` (Task 1), mapped to `settings.permissions` by `tenant.mapper.ts:61`.
- Produces: `DEFAULT_PERMISSIONS` (a `Record<string, Record<string, 'full'|'view'|'none'>>`) exported from `@/shared/constants/permissions`.

**Note on testing:** admin-v2 has NO JS test runner (`package.json` scripts are dev/build/start/lint only; no vitest/jest). The only automated frontend check is `npx tsc --noEmit`. Verification here is tsc + the Task 1 backend round-trip tests (which prove the data layer). The resolver change is a pure fallback lookup; verify its correctness by reading the diff against the baseline table.

- [ ] **Step 1: Create the shared default-permissions constant**

Create `apps/admin-v2/src/shared/constants/permissions.ts`:

```ts
export type Permission = 'full' | 'view' | 'none';

// Matrix is keyed by DISPLAY role names (matches the Permisos editor and
// ROLE_TO_MATRIX in use-permissions.ts) × section names.
export const DEFAULT_PERMISSIONS: Record<string, Record<string, Permission>> = {
  Admin: {
    Dashboard: 'full', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'full', Equipo: 'full', Reportes: 'full', Config: 'full',
  },
  Cajero: {
    Dashboard: 'view', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'view', Equipo: 'none', Reportes: 'none', Config: 'none',
  },
  Lavador: {
    Dashboard: 'view', Reservas: 'view', Registro: 'full', Clientes: 'none',
    Servicios: 'none', Equipo: 'none', Reportes: 'none', Config: 'none',
  },
  Cliente: {
    Dashboard: 'none', Reservas: 'none', Registro: 'none', Clientes: 'none',
    Servicios: 'none', Equipo: 'none', Reportes: 'none', Config: 'none',
  },
};
```

- [ ] **Step 2: Wire the fallback into `use-permissions.ts`**

In `apps/admin-v2/src/presentation/hooks/use-permissions.ts`:

(a) Add the import after the existing imports (after line 5):
```ts
import { DEFAULT_PERMISSIONS } from '@/shared/constants/permissions';
```

(b) Replace the resolution line (line 55):
```ts
      const permission = settings?.permissions?.[matrixKey]?.[section] ?? 'none';
```
with:
```ts
      const permission =
        settings?.permissions?.[matrixKey]?.[section]
        ?? DEFAULT_PERMISSIONS[matrixKey]?.[section]
        ?? 'none';
```

Leave the owner/tenant_admin early-return, the client denial, and the `HREF_TO_SECTION`/`ROLE_TO_MATRIX` maps unchanged.

- [ ] **Step 3: Seed the editor's initial grid from the baseline**

In `apps/admin-v2/src/presentation/components/features/settings/permissions-tab.tsx`:

(a) Add the import (near the top, with the other imports):
```ts
import { DEFAULT_PERMISSIONS } from '@/shared/constants/permissions';
```

(b) In `buildDefaultMatrix()`, replace the inner assignment (line 50):
```ts
      matrix[role][section] = role === 'Admin' ? 'full' : 'none';
```
with:
```ts
      matrix[role][section] = DEFAULT_PERMISSIONS[role]?.[section] ?? 'none';
```

Keep the local `ROLES`, `SECTIONS`, `Permission`, `PermissionsMatrix`, `PERMISSION_CYCLE`, `PERMISSION_LABEL`, `PERMISSION_DISPLAY` declarations as they are — only the default value source changes.

- [ ] **Step 4: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/shared/constants/permissions.ts \
        apps/admin-v2/src/presentation/hooks/use-permissions.ts \
        apps/admin-v2/src/presentation/components/features/settings/permissions-tab.tsx
git commit -m "fix(admin): default per-role permission baseline so cashier/washer aren't locked out"
```

---

## Self-Review

**Spec coverage:**
- Backend persist `permissions` → Task 1 Step 3. ✓
- Backend return `permissions` → Task 1 Step 4 (+ Step 5 guards `show()`). ✓
- Frontend shared baseline + resolver fallback → Task 2 Steps 1-2. ✓
- Editor initial grid from baseline (so saving a fresh grid keeps sensible defaults) → Task 2 Step 3. ✓
- Baseline table matches the locked values in Global Constraints. ✓
- Round-trip + no-clobber + present-when-unset tests → Task 1 Step 1. ✓
- Out-of-scope items untouched. ✓

**Placeholder scan:** No TBD/TODO. All code literal. Task 1 Step 5 is a conditional (verify `show()`), with the exact remedy code given if needed — not a placeholder.

**Type consistency:** `DEFAULT_PERMISSIONS` typed `Record<string, Record<string, Permission>>`; indexed in `use-permissions.ts` by `matrixKey`/`section` (both `string`) and in `permissions-tab.tsx` by `role`/`section` (both `string`) — no index-type friction. Cell type `'full'|'view'|'none'` matches `permissions-tab`'s local `Permission`. Role/section key names identical everywhere.

## Notes for the implementer

- Why frontend default (not a backend seed): existing tenants have `settings` without `permissions`; a frontend fallback fixes them all with no data migration, while the round-trip lets owners override.
- Explicit owner config wins: once a matrix is saved, `settings.permissions[role][section]` is set for every cell, so the `?? DEFAULT_PERMISSIONS` fallback is only consulted where a cell is genuinely absent.
- No JS test runner exists in admin-v2 — do not invent one; `tsc` + the backend round-trip tests are the verification.
