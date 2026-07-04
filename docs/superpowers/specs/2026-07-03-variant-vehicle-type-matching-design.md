# Variant ↔ Vehicle-Type Matching (structured) — Design

**Date:** 2026-07-03
**Status:** Approved (brainstorming), pending spec review
**Affects:** prod (`turnly_prod`) — real car_wash tenant

## Problem

Car-wash service variants auto-suggest by matching the customer's vehicle to the variant. Today the match is a **fragile keyword substring** and is **duplicated** in two drifting implementations:

1. Backend `app/Domain/Reservation/VariantSuggester.php` + tenant `custom_fields[].variant_map` (`{vehicle_type value → keyword[]}`). Endpoint `GET /public/services/{id}/suggested-variant?resource_id=` (`PublicController::suggestVariant`). Consumed by the **customer_v2** app.
2. Admin `apps/admin-v2/src/presentation/components/features/services/variant-suggestion.tsx` with its own hardcoded `SIZE_BY_VEHICLE_TYPE` keyword map (reservation detail, car_wash-gated).

Match succeeds only if a variant **label** contains a keyword. Free-text labels like "Auto"/"Camioneta/SUV" silently fail against vehicle_type "Hatchback" (keywords `pequeño/small/hatchback`). Result: no suggestion → customer forced to pick manually. The `variant_map` is invisible/uneditable in the admin, so nobody can see why it fails.

## Goal

Replace keyword matching with a **structured, single-source match**: each service variant declares which vehicle types it covers; the vehicle's `vehicle_type` is matched by exact membership. One matcher, consumed identically by web and mobile.

## Chosen approach (Option B) + locked field

- **Vocabulary = the `options` of the tenant custom field flagged `affects_variant: true`** (car_wash key `vehicle_type`). No parallel taxonomy.
- Each **service variant** stores `vehicle_types: string[]` — a subset of those options.
- **Match** = `vehicle.vehicle_type ∈ variant.vehicle_types` (exact string membership). No keywords, no substring.
- The `affects_variant` field is **system-managed and undeletable** per business_type, seeded from `BusinessTypeTemplates`. Its `key` and `affects_variant` flag are locked. Seeded options are locked (no rename, no delete). Tenants **may add extra options** (add-only, e.g. "Moto").

### Why this eliminates the integrity problem
Because canonical option labels are immutable, matching by string value is safe forever — a variant's `vehicle_types` and a customer's stored `client_resources.data.vehicle_type` can never be orphaned by a rename. This removes the need for stable option IDs and any data migration of existing `client_resources`.

Rejected: Option A (separate canonical size taxonomy entity) — duplicates the vehicle_type options that already exist; more moving parts for no gain.

## Components & changes

### Backend (`apps/backend`)
1. **Migration**: add `vehicle_types` (JSON, nullable) to `service_variants`.
2. **`ServiceVariantModel`**: add `vehicle_types` to `$fillable`; cast to `array`.
3. **`Service/ServiceVariantController`**: accept/validate `vehicle_types` (array of strings, each must be a current option of the tenant's `affects_variant` field) on create/update.
4. **`VariantSuggester::suggest`**: rewrite. Read the vehicle's value at `data[affects_variant.key]`; return the first active variant whose `vehicle_types` contains that value. Remove all `variant_map`/keyword logic. Return `null` when no field, no value, or no covering variant.
5. **`BusinessTypeTemplates`**: mark the `affects_variant` field as `system: true` / `locked: true`; keep `options`; stop seeding `variant_map` (deprecated). Keep existing `affects_variant: true`.
6. **`TenantSettingsController`** (custom_fields update): enforce locks — reject deleting the locked field, reject renaming/removing seeded options and changing the locked `key`/`affects_variant`; allow appending new options only.
7. **Backfill** (one-off command or migration data step): populate `vehicle_types` for existing variants by running the OLD keyword logic once (best-effort), so live tenants keep working without manual re-entry. Log variants left empty for admin follow-up. No silent gaps.

### Admin (`apps/admin-v2`)
1. **`domain/entities/service-variant.ts`**: add `vehicleTypes: string[]`.
2. **Mappers**: map `vehicle_types` ↔ `vehicleTypes`.
3. **`services/variant-editor.tsx`**: multi-select populated from the tenant's `affects_variant` field options (no free text). Show a **coverage indicator** — which vehicle types have no covering variant (gap → those customers get no suggestion) and which have 2+ (overlap → first wins, flag as ambiguous). Coverage is advisory, not a hard block (variants may cover 0 types → never auto-suggested).
4. **`services/variant-suggestion.tsx`**: delete `SIZE_BY_VEHICLE_TYPE`; source the suggestion from the backend (call `suggested-variant`, or compute from `vehicleTypes` using the same membership rule). Single source of truth.
5. **`settings/custom-fields-tab.tsx`**: render the locked `affects_variant` field as read-only for key/label/delete; allow add-only for its options; hide `variant_map` entirely.

### Mobile (`apps/customer_v2`)
- **No match logic.** Continues to call `suggested-variant` and falls back to the manual variant picker on `null`. Backend is the sole source of truth. No validation client-side. (Optional: expose `vehicleTypes` on the variant entity only if a future UI needs it — not required now.)

## Data flow
1. Admin defines variants, each tagged with covered vehicle types (from the locked options list).
2. Customer picks a vehicle → app calls `GET /public/services/{id}/suggested-variant?resource_id=`.
3. Backend `VariantSuggester` reads `resource.data[vehicle_type]`, returns the variant whose `vehicle_types` contains it, else `null`.
4. App pre-selects the suggested variant; on `null`, shows the manual picker.
5. Admin reservation detail uses the same backend result (no local matcher).

## Validation / edge cases
- No `affects_variant` field, or vehicle has no `vehicle_type` value → `null` → manual picker.
- Vehicle type not covered by any variant (gap, incl. a tenant-added option like "Moto") → `null` → manual picker.
- Multiple variants cover the same type (overlap) → first active by `sort_order` wins; admin coverage indicator flags it.
- Tenant attempts to delete locked field / rename seeded option → rejected by `TenantSettingsController` with a clear error.

## Testing
- **Backend (Pest)**: `VariantSuggester` — match, no-match (gap), no-field, no-value, overlap-first-wins. `TenantSettingsController` — reject delete/rename of locked field/options, allow add. `ServiceVariantController` — reject `vehicle_types` value not in options.
- **Admin**: variant-editor renders options from the affects_variant field; coverage indicator computes gaps/overlaps; variant-suggestion uses backend result.
- **Manual (prod-like)**: register a Hatchback vehicle, tag "Auto" variant with [Sedán, Hatchback], confirm auto-suggest in the customer app.

## Out of scope
- Stable option IDs / custom option renaming (unnecessary given locked labels).
- Non-car_wash verticals beyond keeping the mechanism vertical-agnostic (any business_type's `affects_variant` field works the same).
- Migrating away from `variant_map` in stored tenant data beyond ignoring it (left inert; may be cleaned later).
