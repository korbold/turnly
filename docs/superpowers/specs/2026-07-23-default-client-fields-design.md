# Default client custom fields (nombre + telefono)

**Date:** 2026-07-23
**Status:** Approved

## Problem

Admin client creation (`ClientForm`) renders inputs dynamically from `tenant.custom_fields`.
When a business type has no custom fields, the form shows "No hay campos configurados"
and the submit button is disabled — staff cannot create a client at all.

Business types today (`BusinessTypeTemplates::getCustomFields`):

- **car_wash**: plate, brand, model, color, vehicle_type — fully identified by vehicle
- **barbershop**: segment only
- **spa**: gender only
- **gym**: goal only
- **medical**: allergies, blood_type, patient_segment
- **other**: `[]` (empty → creation blocked)

No type includes a client name/phone field. A peluquería (barbershop) staff cannot
identify a walk-in client by name.

## Goal

Every new business except **car_wash** gets `nombre` + `telefono` custom fields by
default, so admin client creation works out of the box. Existing businesses are
backfilled. car_wash is excluded because the vehicle plate already identifies the client.

## Design

### Field definitions (shared base)

- `nombre` — type `text`, `required=false`, `capitalize=true`, `affects_variant=false`
- `telefono` — type `text`, `required=false`, `affects_variant=false`

`required=false` deliberately: the same `custom_fields` schema drives the **public
booking flow** where the customer is already authenticated (name/phone on account).
Making them required would force redundant re-entry at booking. Optional unblocks admin
creation without harming public UX. Not `affects_variant` → tenant can edit/remove later.

### Change 1 — `app/Domain/Tenant/BusinessTypeTemplates.php`

Add a shared base array `[nombre, telefono]`. In `getCustomFields`, prepend the base to
every type **except car_wash**. Resulting fields:

| Type | Fields |
|---|---|
| barbershop | nombre, telefono, segment |
| spa | nombre, telefono, gender |
| gym | nombre, telefono, goal |
| medical | nombre, telefono, allergies, blood_type, patient_segment |
| other | nombre, telefono |
| car_wash | unchanged |

New businesses are seeded automatically via `OnboardingController::setBusinessType`
(single call site, calls `BusinessTypeTemplates::getCustomFields`).

### Change 2 — backfill migration

New additive migration modeled on `2026_06_02_300001_backfill_business_type_custom_fields`:

- Iterate tenants with non-null `business_type != 'car_wash'`, not soft-deleted.
- Append `nombre` and `telefono` by key only if missing from existing `custom_fields`.
- Guard writes with an `$appended` flag (write only when something changed).
- `down()`: remove the `nombre`/`telefono` keys that were appended (additive-safe reverse).

Do NOT re-run the old backfill migration; write a fresh one.

## Testing

- Unit: `BusinessTypeTemplates::getCustomFields('barbershop')` includes `nombre`+`telefono`;
  `getCustomFields('car_wash')` does NOT.
- Feature: onboarding `setBusinessType` for barbershop seeds nombre+telefono into tenant.
- Migration: tenant missing fields gets them appended; tenant already having `nombre` is
  left intact; car_wash tenant untouched.

## Out of scope

- No admin UI changes (`ClientForm` already renders whatever fields exist).
- No change to `segment`/variant behavior.
- No change to public booking flow beyond the two new optional fields appearing.
