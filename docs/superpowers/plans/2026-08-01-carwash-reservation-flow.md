# Car-Wash Reservation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A client-first, multi-service reservation wizard for `car_wash` tenants (vehicle drives variant/price, like Registro Diario), gated by `businessType` so other verticals keep the current wizard; backend made duration-aware so slots + conflict validation reflect the real summed span.

**Architecture:** Backend threads the real total duration into `available-slots` (new optional `duration_min`) and into create-time conflict/business-hours validation. Frontend adds a new `CarwashReservationModal` selected by `businessType`, sending `items[]`, reusing the service-log flow's client picker + variant-suggestion.

**Tech Stack:** Laravel (Pest), Next.js 16 (TypeScript — no JS test runner; `tsc --noEmit` only).

## Global Constraints

- Non-`car_wash` behavior must not change: `available-slots` without `duration_min` keeps the fixed `slot_duration_minutes` grid; `create-modal.tsx` (generic wizard) is untouched.
- Do NOT refactor `new-service-modal.tsx` (keep Registro Diario stable). Reuse its patterns by consuming shared hooks/components and duplicating minimal glue.
- Backend Pest: feature tests auto-`RefreshDatabase`; the `tenant.member` guard requires an active `TenantUserModel` owner row for the acting user (mirror `ReservationTest.php` beforeEach lines 23-29). `ServiceVariantModel` has NO factory — create manually with `duration_min`.
- Frontend verification is `tsc --noEmit` (run from `apps/admin-v2/`). Backend tests from `apps/backend/`: `./vendor/bin/pest <path>`.
- Duration source of truth is `service_variants.duration_min` summed as `Σ(duration_min × qty)`; `services` has no duration.

---

### Task 1: Backend — duration-aware available-slots + conflict validation

**Files:**
- Modify: `app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php`
- Modify: `app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php`
- Modify: `app/Application/DTOs/Reservation/CreateReservationDTO.php`
- Modify: `app/Application/UseCases/Reservation/CreateReservationUseCase.php`
- Modify: `app/Infrastructure/Http/Controllers/Reservation/ReservationController.php` (`availableSlots`, `store`)
- Test: `apps/backend/tests/Feature/Reservation/DurationAwareReservationTest.php`

**Interfaces:**
- `AvailableSlotsQueryDTO` gains `?int $durationMinutes`; `CreateReservationDTO` gains `?int $durationMinutes`. `available-slots` accepts `duration_min`. Create validation uses the summed duration.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Reservation/DurationAwareReservationTest.php`:

```php
<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'settings' => ['slot_duration_minutes' => 30]]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id, 'role' => 'owner', 'is_active' => true,
    ]);
});

function durSlot(object $t, int $day, string $start, string $end, int $maxConcurrent = 1): void
{
    AvailabilitySlotModel::create([
        'tenant_id' => $t->tenant->id, 'day_of_week' => $day,
        'start_time' => $start, 'end_time' => $end,
        'max_concurrent' => $maxConcurrent, 'is_active' => true,
    ]);
}

function durVariant(object $t, int $duration, float $price = 10): ServiceVariantModel
{
    return ServiceVariantModel::create([
        'tenant_id' => $t->tenant->id, 'service_id' => $t->service->id,
        'label' => "v{$duration}", 'price' => $price, 'duration_min' => $duration,
    ]);
}

test('available-slots duration_min widens each slot so fewer fit before close', function () {
    $day = (int) now()->addDay()->format('N') - 1;
    durSlot($this, $day, '08:00:00', '10:00:00', 5);
    $date = now()->addDay()->format('Y-m-d');

    $base = $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}")
        ->assertOk()->json('data');

    $long = $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}&duration_min=90")
        ->assertOk()->json('data');

    // 08:00-10:00 = 120 min. 30-min slots → 4 start times; a 90-min block only
    // fits starting 08:00 and 08:30 → fewer slots.
    expect(count($long))->toBeLessThan(count($base));
    expect(count($long))->toBeGreaterThan(0);
});

test('multi-item reservation blocks its real summed span for max_concurrent', function () {
    $day = (int) now()->addDay()->format('N') - 1;
    durSlot($this, $day, '00:00:00', '23:59:00', 1); // max_concurrent = 1
    $v1 = durVariant($this, 45);
    $v2 = durVariant($this, 45);

    $at = now()->addDay()->setTime(9, 0, 0);

    // Reservation A: two 45-min lines = 90 min → 09:00-10:30
    $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'scheduled_at' => $at->toIso8601String(),
            'items' => [
                ['service_variant_id' => $v1->id, 'qty' => 1],
                ['service_variant_id' => $v2->id, 'qty' => 1],
            ],
        ])->assertStatus(201);

    $reservation = \App\Infrastructure\Persistence\Models\ReservationModel::query()->latest('created_at')->first();
    expect(ReservationItemModel::where('reservation_id', $reservation->id)->count())->toBe(2);
    // estimated_end stretched to +90 min
    expect(\Illuminate\Support\Carbon::parse($reservation->estimated_end)->format('H:i'))->toBe('10:30');

    // Reservation B at 10:00 falls INSIDE A's real 90-min span → must conflict
    // (before the fix, A was validated as 30 min ending 09:30, so B was allowed).
    $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'scheduled_at' => now()->addDay()->setTime(10, 0, 0)->toIso8601String(),
            'items' => [['service_variant_id' => $v1->id, 'qty' => 1]],
        ])->assertStatus(422);
});

test('legacy single service_id reservation still creates', function () {
    durSlot($this, (int) now()->addDay()->format('N') - 1, '00:00:00', '23:59:00', 10);

    $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id' => $this->service->id,
            'scheduled_at' => now()->addDay()->setTime(9, 0, 0)->toIso8601String(),
        ])->assertStatus(201);
});
```

Note: the conflict test asserts `422`. Before running, confirm the HTTP code `ReservationConflictException` maps to (grep an existing conflict test or the exception handler); if it renders a different code (e.g. 409), update the two `assertStatus` in the conflict test to match. Quote what you find in the report.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Reservation/DurationAwareReservationTest.php`
Expected: FAIL — duration_min ignored (slot counts equal); reservation B at 10:00 is allowed (201, not 422) because A is validated as 30 min.

- [ ] **Step 3: Add `durationMinutes` to `AvailableSlotsQueryDTO`**

In `app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php`, add a constructor prop after `businessResourceId` and map it in `fromArray`:
```php
        public ?string $businessResourceId = null,
        public ?int $durationMinutes = null,
```
```php
            businessResourceId: $data['business_resource_id'] ?? null,
            durationMinutes: $data['duration_min'] ?? null,
```

- [ ] **Step 4: Use duration for slot LENGTH (keep tenant step for granularity) in `GetAvailableSlotsUseCase`**

In `app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php`, replace line 23 and the grid loop (lines 56-86) so the step stays the tenant slot but the slot length/overlap window uses the requested duration:

Replace line 23:
```php
        $durationMinutes = $tenant?->settings['slot_duration_minutes'] ?? 30;
```
with:
```php
        $step = (int) ($tenant?->settings['slot_duration_minutes'] ?? 30);
        $length = $dto->durationMinutes && $dto->durationMinutes > 0 ? (int) $dto->durationMinutes : $step;
```

Then in the loop (currently lines 56-86), use `$step` to advance and `$length` for the slot end / guard:
```php
            $current = $startTime;
            while ($current->modify("+{$length} minutes") <= $endTime) {
                $slotEnd = $current->modify("+{$length} minutes");

                if ($isToday && $current < $now) {
                    $current = $current->modify("+{$step} minutes");
                    continue;
                }

                $overlapping = 0;
                foreach ($existingReservations as $reservation) {
                    $resStart = $reservation->scheduledAt;
                    $resEnd = $reservation->estimatedEnd;
                    if ($current < $resEnd && $slotEnd > $resStart) {
                        $overlapping++;
                    }
                }

                if ($overlapping < $maxConcurrent) {
                    $slots[] = [
                        'start' => $current->format('Y-m-d H:i:s'),
                        'end' => $slotEnd->format('Y-m-d H:i:s'),
                        'available' => $maxConcurrent - $overlapping,
                    ];
                }

                $current = $current->modify("+{$step} minutes");
            }
```

- [ ] **Step 5: Read `duration_min` in the `availableSlots` controller**

In `ReservationController::availableSlots` (lines 480-491), add the validation rule and pass it to the DTO:
```php
            'business_resource_id' => 'nullable|uuid|exists:business_resources,id,tenant_id,' . app('current_tenant_id'),
            'duration_min'         => 'nullable|integer|min:1|max:600',
```
```php
            businessResourceId: $request->business_resource_id,
            durationMinutes:    $request->duration_min !== null ? (int) $request->duration_min : null,
```

- [ ] **Step 6: Add `durationMinutes` to `CreateReservationDTO`**

In `app/Application/DTOs/Reservation/CreateReservationDTO.php`, add after `businessResourceId`:
```php
        public ?string $businessResourceId = null,
        public ?int $durationMinutes = null,
```
and in `fromArray`:
```php
            businessResourceId: $data['business_resource_id'] ?? null,
            durationMinutes: $data['duration_min'] ?? null,
```

- [ ] **Step 7: Use the real duration in `CreateReservationUseCase`**

In `app/Application/UseCases/Reservation/CreateReservationUseCase.php`, replace line 33:
```php
        $slotDuration = $tenant?->settings['slot_duration_minutes'] ?? 30;
```
with:
```php
        $slotDuration = $dto->durationMinutes && $dto->durationMinutes > 0
            ? (int) $dto->durationMinutes
            : ($tenant?->settings['slot_duration_minutes'] ?? 30);
```
Everything downstream (`$estimatedEnd`, business-hours end check, `findConflicting`, resource assigner, persisted `estimatedEnd`) now uses the real duration. Leave the rest of the method unchanged.

- [ ] **Step 8: Thread `totalDurationMin` into the DTO in `store()`**

In `ReservationController::store` (the `new CreateReservationDTO(...)` at lines 219-230), add:
```php
            serviceVariantId: $variantId,
            businessResourceId: $request->business_resource_id,
            durationMinutes: $totalDurationMin,
```
`$totalDurationMin` is already computed by `resolveItems()` above (line 207-208). For the legacy service-only path it equals the tenant slot default, so behavior is unchanged there. The post-create `estimated_end` stretch (lines 258-263) now writes the same value the use case validated against — leave it as-is (harmless, keeps the items path explicit).

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Reservation/DurationAwareReservationTest.php`
Expected: PASS (3 tests).

- [ ] **Step 10: Regression — reservation suite**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Reservation/`
Expected: PASS except the known pre-existing `ReservationInvoiceTest` baseline failures (3) — confirm no NEW failures vs baseline.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/app/Application/DTOs/Reservation/AvailableSlotsQueryDTO.php \
        apps/backend/app/Application/UseCases/Reservation/GetAvailableSlotsUseCase.php \
        apps/backend/app/Application/DTOs/Reservation/CreateReservationDTO.php \
        apps/backend/app/Application/UseCases/Reservation/CreateReservationUseCase.php \
        apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php \
        apps/backend/tests/Feature/Reservation/DurationAwareReservationTest.php
git commit -m "feat(reservations): duration-aware slots + conflict validation for multi-service"
```

---

### Task 2: Frontend — thread duration + items through the reservation API layer

**Files:**
- Modify: `apps/admin-v2/src/domain/repositories/reservation.repository.ts` (`CreateReservationData`, `getAvailableSlots` signature)
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-reservation.repository.ts` (`create`, `getAvailableSlots`)
- Modify: `apps/admin-v2/src/application/use-cases/reservations/get-available-slots.use-case.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-reservations.ts` (`useAvailableSlots`)

**Interfaces:**
- `CreateReservationData` gains `items?: { serviceVariantId: string; qty: number }[]`.
- `getAvailableSlots(date, serviceId, durationMin?)` end to end; `useAvailableSlots(date, serviceId, durationMin?)`.

- [ ] **Step 1: Extend the domain types**

In `apps/admin-v2/src/domain/repositories/reservation.repository.ts`:
- Add to `CreateReservationData` (after `notes?`):
```ts
  items?: { serviceVariantId: string; qty: number }[];
```
- Change the interface method signature (line ~50):
```ts
  getAvailableSlots(date: string, serviceId: string, durationMin?: number): Promise<AvailableSlot[]>;
```

- [ ] **Step 2: Implement in the API repository**

In `apps/admin-v2/src/infrastructure/api/repositories/api-reservation.repository.ts`:
- `create` (lines 60-70): when `data.items` is present, send `items` (snake_case per line) instead of/in addition to the single-service fields:
```ts
  async create(data: CreateReservationData): Promise<Reservation> {
    const { data: res } = await api.post('/reservations', {
      client_resource_id: data.clientResourceId,
      service_id: data.serviceId,
      service_variant_id: data.serviceVariantId,
      scheduled_at: data.scheduledAt,
      assigned_to: data.assignedTo,
      notes: data.notes,
      items: data.items?.map((it) => ({ service_variant_id: it.serviceVariantId, qty: it.qty })),
    });
    return mapReservation(res.data);
  }
```
(The backend `CreateReservationRequest` makes `service_id` optional when `items` is present, so sending `service_id: undefined` with `items` is valid.)
- `getAvailableSlots` (lines 89-94): add the param and query:
```ts
  async getAvailableSlots(date: string, serviceId: string, durationMin?: number): Promise<AvailableSlot[]> {
    const { data: res } = await api.get('/reservations/available-slots', {
      params: { date, service_id: serviceId, duration_min: durationMin },
    });
    return (res.data as Record<string, unknown>[]).map(mapAvailableSlot);
  }
```

- [ ] **Step 3: Thread through the use-case + hook**

In `apps/admin-v2/src/application/use-cases/reservations/get-available-slots.use-case.ts`:
```ts
  execute(date: string, serviceId: string, durationMin?: number) {
    return this.repo.getAvailableSlots(date, serviceId, durationMin);
  }
```
In `apps/admin-v2/src/presentation/hooks/use-reservations.ts` (`useAvailableSlots`, lines 26-33):
```ts
export function useAvailableSlots(date: string | undefined, serviceId: string | undefined, durationMin?: number) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['available-slots', date, serviceId, durationMin],
    queryFn: () => new GetAvailableSlotsUseCase(repo).execute(date!, serviceId!, durationMin),
    enabled: !!date && !!serviceId,
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: clean. (The existing `create-modal.tsx` still calls `useAvailableSlots(date, serviceId)` — the new `durationMin` is optional, so it still compiles.)

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/domain/repositories/reservation.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-reservation.repository.ts \
        apps/admin-v2/src/application/use-cases/reservations/get-available-slots.use-case.ts \
        apps/admin-v2/src/presentation/hooks/use-reservations.ts
git commit -m "feat(reservations): API layer supports items[] + duration-aware slots"
```

---

### Task 3: Frontend — `CarwashReservationModal` + businessType branch

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/reservations/carwash-create-modal.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/reservations/page.tsx`

**Interfaces:**
- Consumes: `useAvailableSlots(date, serviceId, durationMin)` + `create` with `items[]` (Task 2); `useClients`/`useCreateClient`; `ServiceCombobox`; `useServiceVariants` (or the `fetchVariantsForService`/`fetchSuggestedVariant` helpers); `useTeam`; `useSettings`.

- [ ] **Step 1: Build the modal component**

Create `apps/admin-v2/src/presentation/components/features/reservations/carwash-create-modal.tsx`, exporting `CarwashReservationModal({ open, onClose }: { open: boolean; onClose: () => void })`. Mirror the shell of `create-modal.tsx` (Dialog wrapper, `step` state 0-3, progress bar, `STEP_TITLES`, Atrás/Siguiente/Crear footer, `canNext` gating, `handleClose` resetting state). Use these steps:

**STEP_TITLES = `['Cliente / Recurso', 'Servicios', 'Fecha y Hora', 'Confirmar']`.**

State: `selectedClientResourceId`, `selectedClientResource` (full object), `clientSearch`, `lineItems: LineItem[]`, `selectedDate`, `selectedSlot`, `assignedTo`, `notes`.

`LineItem` shape (mirror new-service-modal lines 117-129, but include duration): `{ service: Service; qty: number; unitPrice: number; variantId: string | null; variantLabel: string | null; durationMin: number; availableVariants: {id,label,price,durationMin}[] | null }`.

- **Step 0 — Cliente / Recurso:** reuse the new-service-modal `order-1` client block verbatim in spirit: `useClients(1, clientSearch || undefined)` for the list; select sets `selectedClientResourceId` + `selectedClientResource`; inline create via `useCreateClient` — quick-create (`{ data: { nombre: text } }`) when `!hasCustomFields`, else the custom-field form using `BUSINESS_TYPE_DEFAULT_FIELDS`/`settings.customFields` (copy the `customFields`/`hasCustomFields` `useMemo` from new-service-modal lines 269-278, and `handleQuickCreateClient`/`handleCustomFormCreate` patterns). Gate `canNext`: `!!selectedClientResourceId`.
- **Step 1 — Servicios:** reuse `ServiceCombobox` (`services` from `useServices()`, `selected={null}`, `onSelect={handleAddLineItem}`), disabled until step 0 done. On add: fetch the service's full variants (use `useServiceVariants` or a `fetchVariantsForService` that also returns `durationMin` — the domain `ServiceVariant` has `durationMin`; do NOT use the slim shape) and auto-pick via `fetchSuggestedVariant(serviceId, selectedClientResourceId)`; render qty + variant picker per line. Re-resolve variants when `selectedClientResourceId` changes (copy the useEffect from new-service-modal lines 209-260). Gate `canNext`: `lineItems.length >= 1 && lineItems.every(l => l.variantId)`.
- **Step 2 — Fecha y Hora:** `Calendar` for date; compute `totalDurationMin = lineItems.reduce((s,l)=>s + l.durationMin * l.qty, 0)`; `useAvailableSlots(dateStr, lineItems[0]?.service.id, totalDurationMin)` for slots. Gate: `!!selectedSlot`.
- **Step 3 — Confirmar:** `assignedTo` from `useTeam()`, `notes`, summary listing each line (`service.name · variantLabel × qty` + `unitPrice`) and total `Σ unitPrice*qty`. Submit via `useCreateReservation().mutate({ clientResourceId, scheduledAt: selectedSlot, assignedTo, notes, items: lineItems.map(l => ({ serviceVariantId: l.variantId!, qty: l.qty })) })`, then `handleClose()` on success + toast.

Use the exact `fetchVariantsForService`/`fetchSuggestedVariant` endpoint shapes from new-service-modal lines 137-168 (but keep `durationMin` from the full variant). Import `ServiceCombobox` from `@/presentation/components/features/service-logs/service-combobox`. Import `useSettings` for `customFields`/`businessType`.

- [ ] **Step 2: Wire the businessType branch in the page**

In `apps/admin-v2/src/presentation/app/(tenant)/reservations/page.tsx`:
- Add imports: `import { useSettings } from '@/presentation/hooks/use-settings';` and `import { CarwashReservationModal } from '@/presentation/components/features/reservations/carwash-create-modal';`.
- Add `const { data: settings } = useSettings();` near the other hooks.
- Replace the render at line 261:
```tsx
      {settings?.businessType === 'car_wash' ? (
        <CarwashReservationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      ) : (
        <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin-v2/src/presentation/components/features/reservations/carwash-create-modal.tsx" \
        "apps/admin-v2/src/presentation/app/(tenant)/reservations/page.tsx"
git commit -m "feat(reservations): client-first multi-service wizard for car_wash tenants"
```

---

## Self-Review

**Spec coverage:** duration-aware slots (Task 1 Steps 3-5) + conflict (Steps 6-8); API layer items[]/duration (Task 2); car_wash modal 4 steps + businessType gate, non-car_wash untouched (Task 3). Backend Pest tests for duration widening, real-span conflict, legacy regression (Task 1 Step 1). ✓

**Placeholder scan:** backend steps are verbatim before/after. Task 3 Step 1 is a construction spec for a novel UI component (can't be verbatim) but names every state field, hook, step, gate, and payload with exact reuse source lines — no vague "handle it". ✓

**Type consistency:** `items` = `{serviceVariantId, qty}[]` in `CreateReservationData` (Task 2) matches the modal's submit map (Task 3) and the backend `items.*.service_variant_id`+`qty` (Task 1 unchanged request). `durationMin?` optional throughout so `create-modal.tsx` still compiles. `LineItem.durationMin` feeds `totalDurationMin` → `useAvailableSlots` third arg → `duration_min` query → DTO. ✓

## Notes for the implementer

- Task 3 is large; build it by transcribing the named blocks from `new-service-modal.tsx` (client picker, variant fetch/suggest, re-resolve effect) and the shell from `create-modal.tsx`, then wire the 4 steps. It has no automated test — verify with `tsc` and, if possible, a manual smoke as a car_wash tenant.
- The domain `ServiceVariant` carries `durationMin` + `vehicleTypes`; use `useServiceVariants(serviceId)` (already imported by create-modal) to get full variants with duration, rather than the slim `{id,label,price}` shape.
- Confirm the reservation conflict HTTP status in Task 1 Step 1 before finalizing the test asserts.
