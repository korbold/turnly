# Availability Schedule & Blocks

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Add weekly schedule configuration and exceptional date/time blocks to tenant settings

---

## 1. Overview

Allow business owners to configure their regular weekly hours and block specific dates/times for holidays, maintenance, or emergencies. Regular schedule is stored in tenant settings JSON. Exceptional blocks are stored in a dedicated database table.

## 2. Regular Schedule (JSON in `tenants.settings`)

Stored at `tenants.settings.schedule`:

```json
{
  "monday":    { "open": "08:00", "close": "18:00", "active": true },
  "tuesday":   { "open": "08:00", "close": "18:00", "active": true },
  "wednesday": { "open": "08:00", "close": "18:00", "active": true },
  "thursday":  { "open": "08:00", "close": "18:00", "active": true },
  "friday":    { "open": "08:00", "close": "18:00", "active": true },
  "saturday":  { "open": "09:00", "close": "14:00", "active": true },
  "sunday":    { "open": null, "close": null, "active": false }
}
```

Saved alongside existing tenant settings via the existing `updateTenantSettings` endpoint. No new backend endpoint needed.

Default schedule (if none configured): Monday-Friday 08:00-18:00, Saturday 09:00-14:00, Sunday closed.

## 3. Exceptional Blocks (Database Table)

### Migration: `availability_blocks`

```sql
CREATE TABLE availability_blocks (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

- `start_time` and `end_time` both NULL = entire day blocked
- `start_time` and `end_time` both set = only that time range blocked

### Model: `AvailabilityBlockModel`

- Namespace: `App\Infrastructure\Persistence\Models`
- Uses `HasUuids`, `TenantScope`
- Fillable: `tenant_id`, `date`, `start_time`, `end_time`, `reason`
- Casts: `date` → date

### Controller: `AvailabilityBlockController`

- `index(Request)` — list blocks for current tenant, ordered by date desc
- `store(Request)` — create block, validate: date required|date, start_time nullable|date_format:H:i, end_time nullable|date_format:H:i|after:start_time, reason nullable|string|max:255
- `destroy(string $id)` — delete block

### Routes

```php
Route::get('/availability-blocks', [AvailabilityBlockController::class, 'index']);
Route::post('/availability-blocks', [AvailabilityBlockController::class, 'store']);
Route::delete('/availability-blocks/{id}', [AvailabilityBlockController::class, 'destroy']);
```

Added to existing tenant-scoped API route group.

## 4. Frontend

### Settings Page — New Section

Add "Horarios de atención" section between "Redes sociales" and "Galería" cards in `settings/page.tsx`.

**Schedule UI:**
- 7 rows (Monday-Sunday)
- Each row: checkbox (active/closed), day name, time input (open), "a", time input (close)
- When unchecked: show "Cerrado", hide time inputs
- Saved with existing "Guardar cambios" button via `settings.schedule`

**Blocks UI:**
- List of existing blocks with date, time range (or "Todo el día"), reason, delete button
- "Agregar bloqueo" button opens inline form: date input, optional start/end time, optional reason
- Each block saved immediately via POST, deleted via DELETE

### New Files

- `apps/admin/src/lib/api/availability-blocks.ts` — `getBlocks()`, `createBlock()`, `deleteBlock()`
- `apps/admin/src/types/availability-block.ts` — `AvailabilityBlock` interface

### Type

```typescript
export interface AvailabilityBlock {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}
```

## 5. Files Summary

### Backend
1. **Create:** Migration for `availability_blocks` table
2. **Create:** `AvailabilityBlockModel`
3. **Create:** `AvailabilityBlockController` with index/store/destroy
4. **Modify:** API routes file — add availability-blocks routes

### Frontend
1. **Create:** `types/availability-block.ts`
2. **Create:** `lib/api/availability-blocks.ts`
3. **Modify:** `app/(tenant)/settings/page.tsx` — add schedule + blocks sections

## 6. What Does NOT Change

- Reservation form (no validation against schedule yet)
- Calendar view
- Available slots endpoint (future: integrate with schedule)
- Existing tenant settings structure (schedule is additive)
