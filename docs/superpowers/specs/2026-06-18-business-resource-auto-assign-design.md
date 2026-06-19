# Business Resource Auto-Assign — Design Spec

**Date:** 2026-06-18
**Status:** Approved

## Goal

When `allow_client_resource_selection = false`, the system automatically assigns a free business resource (station, chair, room) to each new reservation. If all resources are occupied in the requested slot, the reservation is rejected with HTTP 409.

## Context

- `business_resources` table exists with `id`, `tenant_id`, `name`, `type`, `is_active`, `sort_order`, `employee_id`.
- `allow_client_resource_selection` is stored in `tenant.settings` JSON column, exposed via `TenantResource`.
- `Reservation` entity currently has no `businessResourceId` field.
- `CreateReservationUseCase` already accesses `TenantModel` and `AvailabilitySlotModel` directly (established pattern).

## Architecture

Single-layer change: `CreateReservationUseCase` gets the assignment logic. No new use cases, no new repository methods.

## Section 1 — Data Layer

### Migration
Add nullable `business_resource_id` column to `reservations`:

```php
$table->foreignUuid('business_resource_id')
    ->nullable()
    ->constrained('business_resources')
    ->nullOnDelete();
```

### `Reservation` entity
Add `public ?string $businessResourceId` as a constructor parameter.

### `CreateReservationDTO`
Add `public ?string $businessResourceId = null`.

### `EloquentReservationRepository`
- `save()`: include `business_resource_id => $reservation->businessResourceId`
- `mapToEntity()`: map `$m->business_resource_id` → `businessResourceId`

## Section 2 — Auto-Assign Logic

In `CreateReservationUseCase::execute()`, after the existing conflict check, add:

```
$hasResources = BusinessResourceModel::forTenant($tenantId)->where('is_active', true)->exists();

if ($hasResources) {
    $allowClientSelection = (bool) ($tenant->settings['allow_client_resource_selection'] ?? false);

    if (!$allowClientSelection) {
        $assigned = BusinessResourceModel::forTenant($tenantId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->first(fn($resource) => !ReservationModel::where('business_resource_id', $resource->id)
                ->where('scheduled_at', '<', $estimatedEnd->format('Y-m-d H:i:s'))
                ->where('estimated_end', '>', $scheduledAt->format('Y-m-d H:i:s'))
                ->whereNotIn('status', ['cancelled', 'no_show'])
                ->exists()
            );

        if (!$assigned) {
            throw new NoResourceAvailableException();
        }

        $businessResourceId = $assigned->id;
    } else {
        $businessResourceId = $dto->businessResourceId; // client-selected
    }
} else {
    $businessResourceId = null; // feature inactive for this tenant
}
```

### New Exception
`App\Domain\BusinessResource\Exceptions\NoResourceAvailableException extends AppException`

- `getErrorCode()` → `'NO_RESOURCE_AVAILABLE'`
- `getStatusCode()` → `409`
- Message: `'No hay recursos disponibles para ese horario'`

Global exception handler in `bootstrap/app.php` auto-renders all `AppException` subclasses as JSON — no controller changes needed.

## Section 3 — Frontend

**`domain/entities/reservation.ts`**
Add `businessResourceId: string | null`.

**API repository mapper**
Include `businessResourceId: raw.business_resource_id ?? null`.

**Reservation detail/card**
Display resource name when `businessResourceId` is set — lookup from `useBusinessResources()` query cache.

## Section 4 — Tests (Pest, SQLite in-memory)

File: `tests/Feature/BusinessResource/BusinessResourceAutoAssignTest.php`

| Test | Setup | Expected |
|------|-------|----------|
| `auto_assigns_first_available_resource` | 2 resources, slot free | resource 1 assigned |
| `assigns_second_when_first_busy` | resource 1 has overlapping reservation | resource 2 assigned |
| `throws_when_all_resources_occupied` | both resources busy | 409 NoResourceAvailableException |
| `skips_assign_when_no_resources` | tenant has no resources | reservation saved, `business_resource_id = null` |
| `uses_client_selected_resource_when_setting_on` | `allow_client_resource_selection = true`, `businessResourceId` in DTO | DTO value used |

## Out of Scope

- Public booking flow resource picker UI (requires frontend booking page changes)
- Resource capacity > 1 (each resource = 1 concurrent slot)
- Reassigning a resource after reservation is created
