# Car-Wash Reservation Flow (client-first, multi-service, duration-aware) — Design

**Date:** 2026-08-01
**Status:** Approved, pending implementation
**Scope:** Admin frontend (Next.js) + backend (Laravel)

## Problem

The admin "Nueva Reserva" wizard (`create-modal.tsx`) is generic and service-first: Servicio → Fecha/Hora → Cliente/Recurso → Confirmar. For a car-wash it's backwards — the vehicle should come first and drive variant/price (as "Registro Diario" already does). The owner wants the reservation creation to mirror the walk-in service-log flow (cliente → vehículo → servicio con variante por vehículo), but **only for `car_wash` tenants**, without entangling the logic of other business types (vertical scaling).

Two supporting facts from the codebase:
- The reservation backend **already supports multi-item create** natively: `CreateReservationRequest` accepts `items[]` (`service_variant_id` + `qty`, max 10), `ReservationController::store` writes `ReservationItemModel` rows in the create transaction and stretches `estimated_end` to `Σ(variant.duration_min × qty)`.
- BUT availability + conflict validation are **fixed-duration**: `GetAvailableSlotsUseCase` and `CreateReservationUseCase` use tenant `settings.slot_duration_minutes` (default 30) and a single `service_id`, so a multi-service booking that really spans 90 min is validated as 30 min and silently stretched afterward — never checked against business hours or `max_concurrent` for its true span, and the slot grid the user picks from doesn't reflect the real length.

## Decisions (locked)

1. **Steps (car_wash):** Cliente/Recurso → Servicios (multi line-item, variant auto-suggested per vehicle) → Fecha y Hora → Confirmar.
2. **Multiple services** per reservation (line items, like Registro Diario), sending `items[]`.
3. **Non-car_wash tenants keep the current generic wizard unchanged** (`create-modal.tsx` untouched). The car-wash flow is a **separate component**, selected by `businessType`.
4. **Fix the duration gap now** (backend): slots and conflict validation must reflect the real total duration.

## Architecture

### Frontend

**Gating** — `reservations/page.tsx` (where `<CreateModal>` renders at ~line 261): read `businessType` from `useSettings()`. If `businessType === 'car_wash'` render the new `<CarwashReservationModal>`; otherwise render the existing `<CreateModal>` unchanged. No `car_wash` conditionals inside `create-modal.tsx`.

**New component** `src/presentation/components/features/reservations/carwash-create-modal.tsx` (`CarwashReservationModal`) — a 4-step `Dialog` wizard mirroring `create-modal.tsx`'s shell (step state, progress bar, Siguiente/Atrás), with steps:

- **Step 1 — Cliente / Recurso.** Search + select an existing client-resource (via `useClients(page, search)`), OR create inline. Reuse the service-log flow's client-create pattern: quick-create when the tenant has no custom fields (`useCreateClient`), or the custom-field form + optional billing profile when it does. On select, keep the full `selectedClientResource` object (its `data` carries the vehicle type used for variant suggestion). Gate: a client-resource is selected/created.
- **Step 2 — Servicios (line items).** Reuse `ServiceCombobox` to add N service lines. For each added line, fetch the service's variants (`GET /services/{id}/variants`) and, using the selected resource, auto-select the matching variant via `GET /services/{id}/suggested-variant?resource_id=…` (the `VariantSuggester` vehicle-type→variant logic). Allow manual variant override per line when no match. If the resource changes (user goes back to step 1), re-resolve each line's variant. Each line carries `{ service_id, service_variant_id, qty (default 1), label, unit_price (from variant), duration_min (from variant) }`. Gate: ≥1 line with a resolved variant. Disabled until step 1 done (same "select client first" dependency the service-log flow enforces).
- **Step 3 — Fecha y Hora.** `Calendar` for date + slot list from `useAvailableSlots(dateStr, firstServiceId, totalDurationMin)` — the hook/endpoint now takes the **summed** duration `Σ(line.duration_min × line.qty)` so slots reflect the real length. Gate: a slot selected.
- **Step 4 — Confirmar.** Optional `assignedTo` (from `useTeam`), optional `notes`, read-only summary listing each service line + variant + qty and the total `Σ line_total`.

**Submit payload** → `POST /reservations`:
```
{
  client_resource_id,
  scheduled_at,           // from the chosen slot
  assigned_to, notes,
  items: [ { service_variant_id, qty }, ... ]   // server derives price/label/duration from the variant
}
```
(No per-line price sent — the backend reads it from the variant, matching the existing reservation `items[]` contract, unlike the service-log which sends explicit prices.)

**Reuse without refactor:** consume the existing `useClients`, `useCreateClient`, `ServiceCombobox`, and the suggested-variant fetch pattern. Do NOT refactor `new-service-modal.tsx` (keep the working service-log flow stable). If a small amount of the client-create form is worth extracting to avoid duplication, that is optional and must not change service-log behavior; default to duplicating the minimal picker rather than risk the shared flow.

### Backend — make availability + conflict duration-aware

The reservation `items[]` create path already exists; the change is threading the real duration into the two fixed-duration spots.

**1. `available-slots` accepts a duration.** `GET /reservations/available-slots` (and the query DTO / `GetAvailableSlotsUseCase`) gains an optional `duration_min` integer param. When present and > 0, the slot grid uses it as the slot width and the overlap window instead of `settings.slot_duration_minutes`; when absent, behavior is unchanged (fallback to `slot_duration_minutes`, default 30) — **backward compatible** for the generic wizard and any existing caller. The car-wash flow passes `Σ(line.duration_min × line.qty)`.

**2. Create-time conflict/business-hours check uses the real total duration.** `ReservationController::store` already computes `totalDurationMin` in `resolveItems()` before running `CreateReservationUseCase`. Thread that value into the use case (extend `CreateReservationDTO` with a nullable `durationMinutes`; when set, `CreateReservationUseCase` computes `estimatedEnd = scheduledAt + durationMinutes` and runs the business-hours + `max_concurrent` conflict check against that real span, instead of the fixed `slot_duration_minutes`). When null (legacy callers with no items), keep the current fixed-duration behavior. This removes the "validate 30, stretch to 90 afterward" bug; the post-hoc `estimated_end` overwrite in the controller becomes consistent with (or redundant to) the validated value.

**Behavior-change note:** making the conflict check use real per-variant duration is a generic correctness fix — it affects any tenant whose variants have `duration_min > slot_duration_minutes` (they were previously under-validated / could overbook). This is intended (it fixes latent overbooking), applies to all verticals, and is orthogonal to the car-wash-only frontend flow. Single-service generic bookings that pass no explicit duration are unaffected (fallback path).

## Data flow

```
car_wash tenant → Nueva Reserva
  Step1 pick/create client-resource (vehicle type in resource.data)
  Step2 add services → per line: suggested-variant(resource) → variant (price+duration)
        totalDuration = Σ(variant.duration_min × qty)
  Step3 available-slots(date, firstService, duration_min=totalDuration) → slots reflect real length
  Step4 confirm → POST /reservations { client_resource_id, scheduled_at, items[], assigned_to, notes }
     → resolveItems → totalDurationMin → CreateReservationUseCase validates real span
       (business hours + max_concurrent) → writes reservation + N reservation_items
       → estimated_end = scheduled_at + totalDurationMin
```

## Error handling / edge cases

- No variant matches a vehicle for a line → manual variant picker shown; line can't be added without a variant.
- Client-resource changed after services chosen → re-resolve variants (drop non-matching, re-suggest).
- `duration_min` omitted / 0 on available-slots → fallback to `slot_duration_minutes` (generic behavior).
- Multi-service span exceeding business hours or `max_concurrent` at that time → create returns the existing conflict error (now correctly triggered for the real span).
- Non-car_wash tenant → never sees the new modal or the duration param; zero behavior change.
- A variant from another tenant in `items[]` → existing 422 INVALID_ITEMS guard in `resolveItems`.

## Testing

**Backend (Pest):**
- `available-slots` with `duration_min=90` returns slots spaced/limited by 90 min (fewer/wider than the 30-min default); without it, unchanged 30-min grid.
- Create a reservation with `items[]` spanning > slot_duration; assert `estimated_end = scheduled_at + Σ duration`, N `reservation_items` rows, and that a second overlapping booking within that real span is rejected by `max_concurrent` (was previously allowed).
- Legacy single `service_id` create (no items, no duration) still works with fixed-duration validation (regression).
- Business-hours rejection triggers for a long multi-service booking that runs past closing.

**Frontend:** admin-v2 has no JS test runner → verify with `tsc --noEmit` + the backend tests. Manual: the flow gated to car_wash; non-car_wash still shows the old wizard.

## Files

**Frontend — new:**
- `src/presentation/components/features/reservations/carwash-create-modal.tsx`

**Frontend — edit:**
- `src/presentation/app/(tenant)/reservations/page.tsx` (branch on `businessType`)
- `src/presentation/hooks/use-available-slots.ts` (pass `duration_min`)
- the reservation API repo (`available-slots` query + create `items[]` if not already wired)

**Backend — edit:**
- `app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php` (+ `durationMin`)
- `app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php` (use duration when present)
- `app/Infrastructure/Http/Controllers/Reservation/ReservationController.php` (`availableSlots` reads `duration_min`; `store` threads `totalDurationMin`)
- `app/Application/DTOs/Reservation/CreateReservationDTO.php` (+ nullable `durationMinutes`)
- `app/Application/UseCases/Reservation/CreateReservationUseCase.php` (validate real span when duration set)

**Backend — test:** `tests/Feature/Reservation/MultiServiceReservationTest.php` (or extend an existing reservation test)

## Out of scope / follow-ups

- Extracting a shared client-resource picker component across service-log + reservation (nice-to-have; avoided here to not destabilize the service-log flow).
- Products as reservation line items (the item model is polymorphic, but this flow adds only service variants).
- The dead `service->duration_minutes` fallback in reschedule paths (column dropped; resolves to 30) — pre-existing, not touched.

## Reference

Frontend: `create-modal.tsx` (generic wizard to leave intact), `new-service-modal.tsx` (client-first pattern to mirror), `ServiceCombobox`, `useClients`/`useCreateClient`, `use-available-slots.ts`. Backend: `CreateReservationRequest` (`items[]` already accepted), `ReservationController::store`/`resolveItems` (multi-item + duration sum), `GetAvailableSlotsUseCase`/`CreateReservationUseCase` (fixed-duration to fix), `VariantSuggester`/`suggestVariant` (vehicle→variant), `service_variants.duration_min`. Related: [[variant_size_matching]] (car_wash variant matching), [[turnly_registro_diario_vs_reservacion]].
