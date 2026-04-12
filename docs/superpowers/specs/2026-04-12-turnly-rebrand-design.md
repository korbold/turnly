# Turnly — Platform Rebrand & Multi-Business Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Rebrand WashFlow → Turnly, generalize for multiple business types, add super admin

---

## 1. Overview

Transform WashFlow (car wash specific) into Turnly, a generic appointment and service management platform that supports multiple business types: car washes, barbershops, medical offices, spas, gyms, and more.

## 2. Branding Changes

| Current | New |
|---------|-----|
| WashFlow | **Turnly** |
| Car wash / lavadero / lavado | Negocio (generic) |
| Vehículos | **Clientes** (with dynamic resource fields) |
| wash_log / Libro Diario | **service_log / Registro del día** |
| "Gestión de lavado de autos" | "Gestión de citas y servicios" |
| washflow.com references | turnly.app |

All references to "wash", "car wash", "lavado", "lavadero" throughout code, UI text, seeders, tests, and documentation must be replaced with generic terms.

## 3. Database Changes

### 3.1 Table `tenants` — Add columns

```
business_type  ENUM('car_wash','barbershop','medical','spa','gym','other') DEFAULT 'other'
custom_fields  JSON NULLABLE  — schema definition for client resource fields
```

`custom_fields` structure:
```json
[
  { "key": "plate", "label": "Placa", "type": "text", "required": true, "options": null },
  { "key": "color", "label": "Color", "type": "select", "required": false, "options": ["Rojo","Azul","Negro","Blanco"] }
]
```

Supported field types: `text`, `number`, `textarea`, `select`

### 3.2 Table `vehicles` → Rename to `client_resources`

Remove fixed columns: `plate`, `brand`, `model`, `color`, `type`

New structure:
```
id          UUID PRIMARY
tenant_id   UUID FK → tenants
client_id   UUID FK → users (owner)
label       VARCHAR(255) — human-readable summary (e.g. "Toyota Corolla ABC-123")
data        JSON — dynamic field values matching tenant.custom_fields schema
created_at  TIMESTAMP
updated_at  TIMESTAMP
deleted_at  TIMESTAMP (soft delete)
```

### 3.3 Table `wash_logs` → Rename to `service_logs`

Same structure, only rename table and all code references. No column changes.

### 3.4 Table `reservations` — Column rename

```
vehicle_id → client_resource_id  (NULLABLE, FK → client_resources)
```

Nullable because not all business types use client resources.

## 4. Business Type Templates

When a tenant selects their business type during onboarding, pre-populate suggested configuration:

| Type | Suggested custom_fields | Suggested services |
|------|------------------------|--------------------|
| `car_wash` | plate (text, required), brand (text), model (text), color (text) | Lavado básico $5, Lavado completo $10, Aspirado $8, Encerado $15 |
| `barbershop` | none | Corte clásico $5, Barba $3, Corte + Barba $7 |
| `medical` | allergies (textarea), blood_type (text) | Consulta general $25, Control $15 |
| `spa` | none | Masaje relajante $20, Facial $15 |
| `gym` | goal (text) | Clase grupal $5, Personal trainer $15 |
| `other` | none | none |

These are suggestions only. The owner can modify, add, or remove fields and services in Settings.

## 5. Feature Flags

Use existing `tenants.settings` JSON field to enable/disable features per tenant:

```json
{
  "features": {
    "client_resources": true,
    "walk_ins": true,
    "payment_tracking": true
  }
}
```

Default features are set based on `business_type` at registration. The owner can toggle them in Settings.

## 6. Onboarding Flow

Updated flow (was 4 steps, now 5):

1. **Registro** — business name, slug, owner name, email, password (exists)
2. **Verificación** — email verification / dev bypass (exists)
3. **Tipo de negocio** — NEW: select business type from 6 options with icons
4. **Configurar servicios** — pre-populated based on business type (exists, enhanced)
5. **Listo** — welcome screen (exists)

Step 3 sets `business_type`, `custom_fields`, and `settings.features` on the tenant. Step 4 pre-creates suggested services.

## 7. Frontend Changes

### 7.1 Sidebar label changes

| Current | New |
|---------|-----|
| Vehículos | **Clientes** |
| Libro Diario | **Registro del día** |
| All other items | Same labels |

### 7.2 Clients page (replaces Vehicles)

- Table columns generated dynamically from `tenant.custom_fields`
- If no custom_fields configured, show only client name and contact info
- Create/edit form renders fields dynamically based on field type
- Label field auto-generated from key fields (e.g. first text + first required field)

### 7.3 All text throughout the app

Replace every "WashFlow", "lavado", "car wash", "lavadero", "vehículo" reference with generic Turnly equivalents.

## 8. Super Admin

### 8.1 User

Created via seeder: `super@turnly.com` / `password`, `is_super_admin = true`

### 8.2 Auth flow

- Login checks `is_super_admin` flag
- If super admin → redirect to `/super-admin`
- If regular user → redirect to `/dashboard` (existing behavior)
- Super admin routes do NOT require `tenant_slug` or `X-Tenant` header

### 8.3 Layout

New route group `(super-admin)` in the admin Next.js app with its own layout and sidebar:

**Super admin sidebar:**
- Dashboard — system-wide stats (total tenants, users, revenue)
- Negocios — list all tenants with filters
- Usuarios — list all users in the system

### 8.4 Negocios page

- Table: name, business_type, plan, status, created_at, actions
- Actions: activate, suspend, view detail
- Filters: by business type, by status, by plan

### 8.5 Usuarios page

- Table: name, email, tenant(s), role, is_super_admin
- Read-only for now

### 8.6 Switch tenant (impersonate)

- Super admin can "enter" any tenant from the Negocios list
- Sets a temporary `tenant_slug` in the session/localStorage
- Reuses existing tenant pages (dashboard, services, reservations, team, etc.)
- Shows a banner: "Viendo: [tenant name]" with a "Volver al panel" button
- Exiting clears the temporary tenant context and returns to `/super-admin`

### 8.7 Backend

Already implemented:
- `EnsureSuperAdminMiddleware` — checks `is_super_admin`
- `GET /api/v1/superadmin/tenants` — list all tenants
- `PATCH /api/v1/superadmin/tenants/{id}/suspend` — suspend
- `PATCH /api/v1/superadmin/tenants/{id}/activate` — activate

Need to add:
- `GET /api/v1/superadmin/users` — list all users with their tenant associations
- `GET /api/v1/superadmin/stats` — system-wide stats for dashboard

## 9. Staff App (Flutter)

- Rebrand WashFlow → Turnly in all text
- Vehicle references → client resource references
- wash_log → service_log references
- Dynamic form rendering for client resources based on tenant custom_fields (fetched from API)

## 10. What Does NOT Change

- Multi-tenant architecture (single database with TenantScope)
- Auth system (Sanctum + tokens)
- Reservation model and logic
- Services, availability slots, permissions
- Project structure (monorepo with apps/)

## 11. Implementation Order

1. **Rebranding** — WashFlow → Turnly across all code and UI
2. **Database migrations** — business_type, custom_fields, client_resources, service_logs, reservation column rename
3. **Dynamic fields** — custom_fields schema on tenant, dynamic form rendering
4. **Onboarding** — new business type selection step
5. **UI updates** — Clients page, Registro del día, dynamic tables
6. **Super admin** — layout, pages, switch tenant functionality
