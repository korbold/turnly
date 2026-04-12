# Plan 2: Dynamic Fields + Onboarding Business Type

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add business type selection step to onboarding, implement dynamic custom fields per tenant, and pre-populate suggested services/fields based on business type.

**Architecture:** New onboarding step between verify-email and configure. Business type templates defined as a shared constant. Backend endpoint to set business type + custom fields. Frontend renders dynamic forms based on custom_fields JSON schema.

**Tech Stack:** Laravel (PHP), Next.js (TypeScript), TanStack Query

**Spec:** `docs/superpowers/specs/2026-04-12-turnly-rebrand-design.md` — Sections 4, 5, 6

**Depends on:** Plan 1 (completed — business_type, custom_fields columns exist on tenants)

---

## Task 1: Backend — business type templates constant

**Files:**
- Create: `apps/backend/app/Domain/Tenant/BusinessTypeTemplates.php`

- [ ] **Step 1: Create business type templates**

```php
<?php

namespace App\Domain\Tenant;

class BusinessTypeTemplates
{
    public static function getCustomFields(string $type): array
    {
        return match ($type) {
            'car_wash' => [
                ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null],
                ['key' => 'brand', 'label' => 'Marca', 'type' => 'text', 'required' => false, 'options' => null],
                ['key' => 'model', 'label' => 'Modelo', 'type' => 'text', 'required' => false, 'options' => null],
                ['key' => 'color', 'label' => 'Color', 'type' => 'text', 'required' => false, 'options' => null],
            ],
            'medical' => [
                ['key' => 'allergies', 'label' => 'Alergias', 'type' => 'textarea', 'required' => false, 'options' => null],
                ['key' => 'blood_type', 'label' => 'Tipo de sangre', 'type' => 'text', 'required' => false, 'options' => null],
            ],
            'gym' => [
                ['key' => 'goal', 'label' => 'Objetivo', 'type' => 'text', 'required' => false, 'options' => null],
            ],
            default => [],
        };
    }

    public static function getSuggestedServices(string $type): array
    {
        return match ($type) {
            'car_wash' => [
                ['name' => 'Lavado básico', 'price' => 5.00, 'description' => 'Lavado exterior completo'],
                ['name' => 'Lavado completo', 'price' => 10.00, 'description' => 'Lavado exterior e interior'],
                ['name' => 'Aspirado', 'price' => 8.00, 'description' => 'Aspirado profundo del interior'],
                ['name' => 'Encerado', 'price' => 15.00, 'description' => 'Encerado de carrocería'],
            ],
            'barbershop' => [
                ['name' => 'Corte clásico', 'price' => 5.00, 'description' => 'Corte de cabello clásico'],
                ['name' => 'Barba', 'price' => 3.00, 'description' => 'Arreglo de barba'],
                ['name' => 'Corte + Barba', 'price' => 7.00, 'description' => 'Corte y arreglo de barba'],
            ],
            'medical' => [
                ['name' => 'Consulta general', 'price' => 25.00, 'description' => 'Consulta médica general'],
                ['name' => 'Control', 'price' => 15.00, 'description' => 'Consulta de control'],
            ],
            'spa' => [
                ['name' => 'Masaje relajante', 'price' => 20.00, 'description' => 'Masaje corporal relajante'],
                ['name' => 'Facial', 'price' => 15.00, 'description' => 'Tratamiento facial'],
            ],
            'gym' => [
                ['name' => 'Clase grupal', 'price' => 5.00, 'description' => 'Clase grupal de ejercicio'],
                ['name' => 'Personal trainer', 'price' => 15.00, 'description' => 'Sesión con entrenador personal'],
            ],
            default => [],
        };
    }

    public static function getDefaultFeatures(string $type): array
    {
        return match ($type) {
            'car_wash' => ['client_resources' => true, 'walk_ins' => true, 'payment_tracking' => true],
            'barbershop' => ['client_resources' => false, 'walk_ins' => true, 'payment_tracking' => true],
            'medical' => ['client_resources' => true, 'walk_ins' => false, 'payment_tracking' => true],
            'spa' => ['client_resources' => false, 'walk_ins' => true, 'payment_tracking' => true],
            'gym' => ['client_resources' => true, 'walk_ins' => false, 'payment_tracking' => false],
            default => ['client_resources' => false, 'walk_ins' => true, 'payment_tracking' => true],
        };
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Domain/Tenant/BusinessTypeTemplates.php
git commit -m "feat: add business type templates for custom fields and services"
```

---

## Task 2: Backend — endpoint to set business type

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Auth/OnboardingController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Add setBusinessType method to OnboardingController**

Add a new method to set the business type during onboarding. This endpoint:
- Validates `business_type` enum
- Sets `business_type`, `custom_fields`, `settings.features` on the tenant
- Optionally creates suggested services
- Updates `onboarding_step` to 3

```php
public function setBusinessType(Request $request): JsonResponse
{
    $request->validate([
        'business_type' => 'required|in:car_wash,barbershop,medical,spa,gym,other',
        'create_suggested_services' => 'nullable|boolean',
    ]);

    $tenantId = app('current_tenant_id');
    $type = $request->business_type;

    $customFields = BusinessTypeTemplates::getCustomFields($type);
    $features = BusinessTypeTemplates::getDefaultFeatures($type);

    TenantModel::where('id', $tenantId)->update([
        'business_type' => $type,
        'custom_fields' => json_encode($customFields),
        'settings' => json_encode(['features' => $features]),
        'onboarding_step' => 3,
    ]);

    // Create suggested services if requested
    if ($request->boolean('create_suggested_services', true)) {
        $suggestedServices = BusinessTypeTemplates::getSuggestedServices($type);
        foreach ($suggestedServices as $index => $service) {
            ServiceModel::create([
                'tenant_id' => $tenantId,
                'name' => $service['name'],
                'price' => $service['price'],
                'description' => $service['description'],
                'is_active' => true,
                'sort_order' => $index + 1,
            ]);
        }
    }

    $tenant = TenantModel::findOrFail($tenantId);

    return response()->json([
        'data' => new TenantResource($tenant),
        'meta' => ['timestamp' => now()->toIso8601String()],
    ]);
}
```

Add necessary imports: `BusinessTypeTemplates`, `TenantModel`, `ServiceModel`.

- [ ] **Step 2: Add route**

In `routes/api.php`, inside the authenticated routes group, add:
```php
Route::post('onboarding/business-type', [OnboardingController::class, 'setBusinessType']);
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Auth/OnboardingController.php apps/backend/routes/api.php
git commit -m "feat: add endpoint to set business type during onboarding"
```

---

## Task 3: Backend — update tenant settings to support profile updates

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php`

- [ ] **Step 1: Expand settings update validation**

The current `update()` only accepts `settings` and `onboarding_step`. Expand to accept all profile fields:

```php
public function update(Request $request): TenantResource
{
    $request->validate([
        'name' => 'nullable|string|max:255',
        'description' => 'nullable|string',
        'address' => 'nullable|string|max:255',
        'phone' => 'nullable|string|max:20',
        'business_type' => 'nullable|in:car_wash,barbershop,medical,spa,gym,other',
        'custom_fields' => 'nullable|array',
        'custom_fields.*.key' => 'required_with:custom_fields|string',
        'custom_fields.*.label' => 'required_with:custom_fields|string',
        'custom_fields.*.type' => 'required_with:custom_fields|in:text,number,textarea,select',
        'custom_fields.*.required' => 'required_with:custom_fields|boolean',
        'social_links' => 'nullable|array',
        'brand_theme' => 'nullable|string|in:blue,green,red,purple,orange,teal,pink,gray',
        'settings' => 'nullable|array',
        'onboarding_step' => 'nullable|integer|min:0',
    ]);

    $tenant = TenantModel::findOrFail(app('current_tenant_id'));
    $tenant->update($request->only([
        'name', 'description', 'address', 'phone', 'business_type',
        'custom_fields', 'social_links', 'brand_theme', 'settings', 'onboarding_step',
    ]));

    return new TenantResource($tenant->fresh());
}
```

Remove the `ConfigureBusinessUseCase` dependency since we're doing a direct update now.

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Tenant/TenantSettingsController.php
git commit -m "feat: expand tenant settings to support all profile fields"
```

---

## Task 4: Frontend — business type templates shared constant

**Files:**
- Create: `apps/admin/src/lib/constants/business-types.ts`

- [ ] **Step 1: Create business types constant**

```typescript
import {
  Car, Scissors, Stethoscope, Sparkles, Dumbbell, Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BusinessType {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { value: 'car_wash', label: 'Lavado de autos', description: 'Car wash y detailing', icon: Car },
  { value: 'barbershop', label: 'Barbería', description: 'Cortes y arreglo de barba', icon: Scissors },
  { value: 'medical', label: 'Consultorio médico', description: 'Consultas y controles', icon: Stethoscope },
  { value: 'spa', label: 'Spa & Belleza', description: 'Masajes y tratamientos', icon: Sparkles },
  { value: 'gym', label: 'Gimnasio', description: 'Clases y entrenamiento', icon: Dumbbell },
  { value: 'other', label: 'Otro', description: 'Cualquier negocio con citas', icon: Building2 },
];

export const BRAND_THEMES = [
  { value: 'blue', label: 'Azul', primary: '#3B82F6', secondary: '#1E40AF' },
  { value: 'green', label: 'Verde', primary: '#22C55E', secondary: '#15803D' },
  { value: 'red', label: 'Rojo', primary: '#EF4444', secondary: '#B91C1C' },
  { value: 'purple', label: 'Púrpura', primary: '#A855F7', secondary: '#7E22CE' },
  { value: 'orange', label: 'Naranja', primary: '#F97316', secondary: '#C2410C' },
  { value: 'teal', label: 'Teal', primary: '#14B8A6', secondary: '#0F766E' },
  { value: 'pink', label: 'Rosa', primary: '#EC4899', secondary: '#BE185D' },
  { value: 'gray', label: 'Gris', primary: '#6B7280', secondary: '#374151' },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/lib/constants/business-types.ts
git commit -m "feat: add business type and brand theme constants"
```

---

## Task 5: Frontend — onboarding API for business type

**Files:**
- Modify: `apps/admin/src/lib/api/onboarding.ts`

- [ ] **Step 1: Add setBusinessType function**

```typescript
export async function setBusinessType(data: {
  business_type: string;
  create_suggested_services?: boolean;
}) {
  const response = await api.post('/onboarding/business-type', data);
  return response.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/lib/api/onboarding.ts
git commit -m "feat: add setBusinessType API function"
```

---

## Task 6: Frontend — business type selection page (new onboarding step)

**Files:**
- Create: `apps/admin/src/app/(onboarding)/business-type/page.tsx`

- [ ] **Step 1: Create business type selection page**

This is the new Step 3 of onboarding (between verify-email and configure). Shows 6 cards in a 2x3 grid, each with an icon, label, and description. Clicking one calls `setBusinessType()` API and redirects to `/configure`.

The page should:
- Display a Card with title "Paso 3: Tipo de negocio"
- Render BUSINESS_TYPES as clickable cards in a grid
- Show loading state while API call is in progress
- Handle errors with user-friendly messages
- On success, redirect to `/configure`
- Import BUSINESS_TYPES from `@/lib/constants/business-types`
- Import setBusinessType from `@/lib/api/onboarding`

- [ ] **Step 2: Update verify-email to redirect to business-type**

In `apps/admin/src/app/(onboarding)/verify-email/page.tsx`, change the redirect from `/configure` to `/business-type` after successful verification.

- [ ] **Step 3: Update configure page step number**

In `apps/admin/src/app/(onboarding)/configure/page.tsx`, change "Paso 3" to "Paso 4" since business-type is now step 3.

- [ ] **Step 4: Update welcome page step number**

In `apps/admin/src/app/(onboarding)/welcome/page.tsx`, change "Paso 4" to "Paso 5".

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/(onboarding)/
git commit -m "feat: add business type selection step to onboarding"
```

---

## Task 7: Frontend — update configure page to show suggested services

**Files:**
- Modify: `apps/admin/src/app/(onboarding)/configure/page.tsx`

- [ ] **Step 1: Update configure page**

The configure page should now show the pre-created services (created by the business-type step). Fetch services using `getServices()` and display them as a list. If services exist, show them. If not, show a message to add services manually.

Keep the "Continuar" button that redirects to `/welcome`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(onboarding)/configure/page.tsx
git commit -m "feat: update configure page to show pre-created services"
```

---

## Task 8: Frontend — tenant settings page with profile fields

**Files:**
- Modify: `apps/admin/src/lib/api/tenant.ts`
- Modify: `apps/admin/src/app/(tenant)/settings/page.tsx`

- [ ] **Step 1: Update tenant API**

Expand `updateTenantSettings()` to accept all profile fields:

```typescript
export async function updateTenantSettings(data: {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  business_type?: string;
  custom_fields?: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] | null }>;
  social_links?: Record<string, string>;
  brand_theme?: string;
  settings?: Record<string, unknown>;
  onboarding_step?: number;
}) {
  const response = await api.patch('/tenant/settings', data);
  return response.data.data;
}
```

- [ ] **Step 2: Rebuild settings page**

Replace the current simple settings page with a comprehensive one that has sections:

1. **Información del negocio** — name, business_type (select), description (textarea), address, phone
2. **Colores de marca** — grid of BRAND_THEMES, clickable color circles with current selection highlighted
3. **Redes sociales** — instagram, facebook, whatsapp text inputs
4. **Campos del cliente** — list of custom_fields with add/remove/edit. Each field shows key, label, type, required toggle. "Agregar campo" button.

Each section should have its own save button or the entire page should have one save button at the bottom.

Use `getTenantSettings()` to load current values and `updateTenantSettings()` to save.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/api/tenant.ts apps/admin/src/app/(tenant)/settings/page.tsx
git commit -m "feat: rebuild settings page with business profile and brand theme"
```

---

## Task 9: Frontend — dynamic form rendering for client resources

**Files:**
- Modify: `apps/admin/src/app/(tenant)/clients/page.tsx`

- [ ] **Step 1: Fetch tenant custom_fields**

The clients page needs to know the tenant's custom_fields to render dynamic columns and forms. Add a query to fetch tenant settings:

```typescript
const { data: tenantData } = useQuery({
  queryKey: ['tenant-settings'],
  queryFn: getTenantSettings,
});
const customFields = tenantData?.custom_fields ?? [];
```

- [ ] **Step 2: Update table columns**

Instead of fixed plate/brand/model/color columns, generate columns dynamically from `customFields`. Always show a "Label" column first, then one column per custom field.

- [ ] **Step 3: Update create/edit form**

The create/edit dialog should render form fields dynamically based on `customFields`. Each field renders as:
- `text` → Input type="text"
- `number` → Input type="number"
- `textarea` → textarea
- `select` → Select with options from field.options

Also include a `label` text input that auto-generates from the first required field value.

- [ ] **Step 4: Update API calls**

The create/update client resource API calls should send `label` and `data` (JSON object with custom field values).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/(tenant)/clients/page.tsx
git commit -m "feat: dynamic form rendering for client resources based on custom_fields"
```

---

## Task 10: Verification

- [ ] **Step 1: Test onboarding flow**

Navigate to http://localhost:3000/register and complete the full onboarding:
1. Register new business
2. Verify email
3. Select business type (new step)
4. See pre-created services
5. Welcome page

- [ ] **Step 2: Test settings page**

Navigate to Settings and verify:
- Can change business type
- Can change brand theme
- Can add/remove custom fields
- Can update social links

- [ ] **Step 3: Test clients page**

Navigate to Clients and verify:
- Table columns match custom_fields
- Create form renders dynamic fields
- Can create a client resource with custom data

- [ ] **Step 4: Run backend tests**

```bash
cd apps/backend && php artisan test
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: verification fixes for Plan 2"
```
