# Low-Stock Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify a business's owner and admin in the in-app bell when a stock movement drives a product from OK to below its minimum.

**Architecture:** `StockLedger::record()` (the single funnel for every movement) detects the OK→low crossing after committing and dispatches a plain Laravel event `ProductStockedLow`. A queued listener `SendLowStockNotification` resolves the tenant's owner+admin and sends a database-channel notification `LowStockForAdmin`. The admin bell already reads DB notifications; a small frontend change routes a clicked low-stock item to `/inventory`.

**Tech Stack:** Laravel (PHP 8, strict types), Pest (SQLite in-memory, sync queue), Next.js 16 admin (TypeScript).

## Global Constraints

- Backend files use `declare(strict_types=1);` where the surrounding file does (StockLedger does; notification/event/listener classes in this app do **not** — match the neighbor file exactly; `InvoiceAuthorized.php` and the events have **no** strict_types line).
- **No `EventServiceProvider` exists.** This is a Laravel 11/12 streamlined-bootstrap app. Register the event→listener mapping with `Event::listen(...)` inside `AppServiceProvider::boot()`. Do NOT create an EventServiceProvider or edit `bootstrap/`.
- Recipients are **owner + tenant_admin only** (never cashier/washer).
- Channel is **`database` only** — no FCM, no Reverb, no email this iteration.
- Fire **only on the OK→low crossing**: `$oldOnHand >= $stockMin && $newOnHand < $stockMin`. No re-notify while already low.
- Feature tests live in `tests/Feature/`; they auto-apply `TestCase` + `RefreshDatabase` via `tests/Pest.php` — do NOT add `uses()`.
- Products are created via `ProductModel::create([...])` (there is **no** ProductFactory). Tenant↔user pivot rows via `TenantUserModel::create([...])` (there is **no** `$tenant->users()->attach()` usage).
- Run backend tests from `apps/backend/`: `./vendor/bin/pest <path>` or `php artisan test --filter=<Name>`.

---

### Task 1: `ProductStockedLow` event + crossing detection in `StockLedger`

**Files:**
- Create: `apps/backend/app/Events/ProductStockedLow.php`
- Modify: `apps/backend/app/Domain/Inventory/StockLedger.php` (imports at lines 1–11; `record()` method lines 91–140)
- Test: `apps/backend/tests/Feature/Inventory/LowStockCrossingTest.php`

**Interfaces:**
- Produces: `App\Events\ProductStockedLow` with promoted public props `(string $tenantId, string $productId, string $productName, float $onHand, float $stockMin, string $unit)`, dispatchable via `ProductStockedLow::dispatch(...)`.
- Consumes: existing `StockLedger` public methods `recordPurchase($p, qty:, unitCost:)`, `recordConsumption($p, qty:)`, `recordAdjustment($p, delta:)`.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Inventory/LowStockCrossingTest.php`:

```php
<?php

use App\Domain\Inventory\StockLedger;
use App\Events\ProductStockedLow;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->ledger = app(StockLedger::class);
});

function lowStockProduct(string $tenantId, array $attrs = []): ProductModel
{
    return ProductModel::create(array_merge([
        'tenant_id' => $tenantId,
        'name'      => 'Shampoo',
        'type'      => 'consumable',
        'unit'      => 'ml',
        'cost'      => 0,
        'price'     => 0,
        'stock_min' => 1000,
        'is_active' => true,
    ], $attrs));
}

test('movement crossing below minimum dispatches ProductStockedLow once', function () {
    Event::fake([ProductStockedLow::class]);
    $p = lowStockProduct($this->tenant->id);

    $this->ledger->recordPurchase($p, qty: 1500, unitCost: 0.01); // 0 -> 1500 (above min, no cross)
    $this->ledger->recordConsumption($p, qty: 600);               // 1500 -> 900 (< 1000, cross)

    Event::assertDispatchedTimes(ProductStockedLow::class, 1);
    Event::assertDispatched(ProductStockedLow::class, function ($e) use ($p) {
        return $e->productId === $p->id
            && $e->onHand === 900.0
            && $e->stockMin === 1000.0
            && $e->unit === 'ml';
    });
});

test('movement while already below minimum does not dispatch', function () {
    Event::fake([ProductStockedLow::class]);
    $p = lowStockProduct($this->tenant->id); // starts at on_hand 0, already < 1000

    $this->ledger->recordConsumption($p, qty: 50);   // 0 -> -50 (was already below)
    $this->ledger->recordAdjustment($p, delta: -30); // -50 -> -80 (still below)

    Event::assertNotDispatched(ProductStockedLow::class);
});

test('movement raising stock does not dispatch', function () {
    Event::fake([ProductStockedLow::class]);
    $p = lowStockProduct($this->tenant->id);

    $this->ledger->recordPurchase($p, qty: 2000, unitCost: 0.01); // 0 -> 2000 (above)

    Event::assertNotDispatched(ProductStockedLow::class);
});

test('movement staying at or above minimum does not dispatch', function () {
    Event::fake([ProductStockedLow::class]);
    $p = lowStockProduct($this->tenant->id);

    $this->ledger->recordPurchase($p, qty: 2000, unitCost: 0.01); // 2000
    $this->ledger->recordConsumption($p, qty: 500);              // 1500, still >= 1000

    Event::assertNotDispatched(ProductStockedLow::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Inventory/LowStockCrossingTest.php`
Expected: FAIL — `Class "App\Events\ProductStockedLow" not found`.

- [ ] **Step 3: Create the event class**

Create `apps/backend/app/Events/ProductStockedLow.php` (mirrors the existing events but WITHOUT `ShouldBroadcast` — no imports of `PrivateChannel`/`ShouldBroadcast`/`InteractsWithSockets`, no `broadcastOn/As/With`):

```php
<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ProductStockedLow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $tenantId,
        public string $productId,
        public string $productName,
        public float $onHand,
        public float $stockMin,
        public string $unit,
    ) {}
}
```

- [ ] **Step 4: Add crossing detection + dispatch in `StockLedger::record()`**

In `apps/backend/app/Domain/Inventory/StockLedger.php`, add the event import after line 9 (the `StockMovementModel` import):

```php
use App\Events\ProductStockedLow;
```

Then replace the current `record()` body (lines 91–140) so the crossing is captured inside the transaction and dispatched **after** commit. The unchanged inner lines (movement create, level lock, avg_cost calc) stay exactly as they are — only the wrapper, the two capture lines, and the post-commit dispatch are new:

```php
    private function record(
        ProductModel $product,
        string $type,
        float $signedQty,
        float $unitCost,
        ?string $userId,
        ?string $refType,
        ?string $refId,
        ?string $note,
    ): StockMovementModel {
        $stockMin = (float) $product->stock_min;
        $crossedLow = false;
        $finalOnHand = 0.0;

        $movement = DB::transaction(function () use (
            $product, $type, $signedQty, $unitCost, $userId, $refType, $refId, $note,
            $stockMin, &$crossedLow, &$finalOnHand
        ) {
            $movement = StockMovementModel::create([
                'tenant_id'  => $product->tenant_id,
                'product_id' => $product->id,
                'type'       => $type,
                'qty'        => $signedQty,
                'unit_cost'  => $unitCost,
                'ref_type'   => $refType,
                'ref_id'     => $refId,
                'user_id'    => $userId,
                'note'       => $note,
            ]);

            // Lock the level row so concurrent purchases/consumptions can't
            // interleave a half-applied weighted-average calc.
            $level = ProductStockLevelModel::query()
                ->lockForUpdate()
                ->firstOrCreate(
                    ['product_id' => $product->id],
                    ['on_hand' => 0, 'reserved' => 0, 'avg_cost' => 0]
                );

            $oldOnHand = (float) $level->on_hand;
            $newOnHand = $oldOnHand + $signedQty;

            if ($type === 'purchase' && $signedQty > 0) {
                // Weighted average: only if there is non-negative existing stock.
                $oldValue = max($oldOnHand, 0) * (float) $level->avg_cost;
                $addedValue = $signedQty * $unitCost;
                $denominator = max($oldOnHand, 0) + $signedQty;
                $level->avg_cost = $denominator > 0 ? ($oldValue + $addedValue) / $denominator : $unitCost;
            }

            $level->on_hand = $newOnHand;
            $level->updated_at = now();
            $level->save();

            // Only the OK->low transition fires; already-low stays silent.
            $crossedLow = $oldOnHand >= $stockMin && $newOnHand < $stockMin;
            $finalOnHand = $newOnHand;

            return $movement;
        });

        if ($crossedLow) {
            ProductStockedLow::dispatch(
                $product->tenant_id,
                $product->id,
                $product->name,
                $finalOnHand,
                $stockMin,
                (string) $product->unit,
            );
        }

        return $movement;
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Inventory/LowStockCrossingTest.php`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the existing ledger test to confirm no regression**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Inventory/StockLedgerTest.php`
Expected: PASS (unchanged behavior — the refactor only adds capture + post-commit dispatch).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Events/ProductStockedLow.php \
        apps/backend/app/Domain/Inventory/StockLedger.php \
        apps/backend/tests/Feature/Inventory/LowStockCrossingTest.php
git commit -m "feat(inventory): dispatch ProductStockedLow on OK->low stock crossing"
```

---

### Task 2: `LowStockForAdmin` notification + `SendLowStockNotification` listener + registration

**Files:**
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/LowStockForAdmin.php`
- Create: `apps/backend/app/Infrastructure/Notifications/Listeners/SendLowStockNotification.php`
- Modify: `apps/backend/app/Providers/AppServiceProvider.php` (add `Event::listen` in `boot()`, starts line 20)
- Test: `apps/backend/tests/Feature/Inventory/LowStockNotificationTest.php`

**Interfaces:**
- Consumes: `App\Events\ProductStockedLow` (from Task 1).
- Produces: `App\Infrastructure\Notifications\Notifications\LowStockForAdmin` with promoted public props `(string $tenantId, string $tenantName, string $productId, string $productName, float $onHand, float $stockMin, string $unit)`; `via()` returns `['database']`; `toArray()` returns keys `title, body, action_type ('inventory'), action_id, product_id, tenant_id, tenant_name, icon ('inventory')`.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Inventory/LowStockNotificationTest.php`:

```php
<?php

use App\Domain\Inventory\StockLedger;
use App\Infrastructure\Notifications\Notifications\LowStockForAdmin;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->ledger = app(StockLedger::class);
});

function attachRole(string $tenantId, string $userId, string $role): void
{
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenantId,
        'user_id'   => $userId,
        'role'      => $role,
        'is_active' => true,
    ]);
}

function notifProduct(string $tenantId): ProductModel
{
    return ProductModel::create([
        'tenant_id' => $tenantId,
        'name'      => 'Shampoo',
        'type'      => 'consumable',
        'unit'      => 'ml',
        'cost'      => 0,
        'price'     => 0,
        'stock_min' => 1000,
        'is_active' => true,
    ]);
}

function crossBelowMin(object $t): ProductModel
{
    $p = notifProduct($t->tenant->id);
    $t->ledger->recordPurchase($p, qty: 1500, unitCost: 0.01); // 1500 (above)
    $t->ledger->recordConsumption($p, qty: 600);               // 900  (cross)
    return $p;
}

test('crossing below minimum notifies owner and admin but not cashier', function () {
    Notification::fake();
    $owner   = UserModel::factory()->create();
    $admin   = UserModel::factory()->create();
    $cashier = UserModel::factory()->create();
    attachRole($this->tenant->id, $owner->id, 'owner');
    attachRole($this->tenant->id, $admin->id, 'tenant_admin');
    attachRole($this->tenant->id, $cashier->id, 'cashier');

    crossBelowMin($this);

    Notification::assertSentTo($owner, LowStockForAdmin::class);
    Notification::assertSentTo($admin, LowStockForAdmin::class);
    Notification::assertNotSentTo($cashier, LowStockForAdmin::class);
});

test('low-stock notification carries inventory action_type and product id', function () {
    Notification::fake();
    $owner = UserModel::factory()->create();
    attachRole($this->tenant->id, $owner->id, 'owner');

    $p = crossBelowMin($this);

    Notification::assertSentTo($owner, LowStockForAdmin::class, function ($notif) use ($p) {
        $data = $notif->toArray($owner);
        return $notif->productId === $p->id
            && $data['action_type'] === 'inventory'
            && $data['action_id'] === $p->id
            && $data['icon'] === 'inventory';
    });
});

test('crossing writes a database notification row for the owner', function () {
    $owner = UserModel::factory()->create();
    attachRole($this->tenant->id, $owner->id, 'owner');

    $p = crossBelowMin($this);

    expect($owner->notifications()->count())->toBe(1);
    $row = $owner->notifications()->first();
    expect($row->data['action_type'])->toBe('inventory');
    expect($row->data['action_id'])->toBe($p->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Inventory/LowStockNotificationTest.php`
Expected: FAIL — `Class "App\Infrastructure\Notifications\Notifications\LowStockForAdmin" not found`.

- [ ] **Step 3: Create the notification class**

Create `apps/backend/app/Infrastructure/Notifications/Notifications/LowStockForAdmin.php` (mirrors `InvoiceAuthorized` but `database`-only — no `FcmChannel`, no `toFcm`, and NOT `ShouldQueue` because the listener is the async boundary):

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LowStockForAdmin extends Notification
{
    use Queueable;

    public function __construct(
        public string $tenantId,
        public string $tenantName,
        public string $productId,
        public string $productName,
        public float $onHand,
        public float $stockMin,
        public string $unit,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title'       => '⚠️ Stock bajo',
            'body'        => "{$this->productName} bajo el mínimo ({$this->onHand}/{$this->stockMin} {$this->unit}).",
            'action_type' => 'inventory',
            'action_id'   => $this->productId,
            'product_id'  => $this->productId,
            'tenant_id'   => $this->tenantId,
            'tenant_name' => $this->tenantName,
            'icon'        => 'inventory',
        ];
    }
}
```

- [ ] **Step 4: Create the listener**

Create `apps/backend/app/Infrastructure/Notifications/Listeners/SendLowStockNotification.php`:

```php
<?php

namespace App\Infrastructure\Notifications\Listeners;

use App\Events\ProductStockedLow;
use App\Infrastructure\Notifications\Notifications\LowStockForAdmin;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class SendLowStockNotification implements ShouldQueue
{
    public function handle(ProductStockedLow $event): void
    {
        try {
            $tenant = TenantModel::find($event->tenantId);
            if (! $tenant) {
                return;
            }

            $admins = $tenant->users()
                ->wherePivotIn('role', ['owner', 'tenant_admin'])
                ->wherePivot('is_active', true)
                ->get();

            if ($admins->isEmpty()) {
                return;
            }

            Notification::send($admins, new LowStockForAdmin(
                tenantId:    $event->tenantId,
                tenantName:  (string) $tenant->name,
                productId:   $event->productId,
                productName: $event->productName,
                onHand:      $event->onHand,
                stockMin:    $event->stockMin,
                unit:        $event->unit,
            ));
        } catch (\Throwable $e) {
            Log::warning('low-stock notify failed', [
                'product_id' => $event->productId,
                'error'      => $e->getMessage(),
            ]);
        }
    }
}
```

- [ ] **Step 5: Register the event→listener in `AppServiceProvider::boot()`**

In `apps/backend/app/Providers/AppServiceProvider.php`, add these imports near the top (with the other `use` statements):

```php
use App\Events\ProductStockedLow;
use App\Infrastructure\Notifications\Listeners\SendLowStockNotification;
use Illuminate\Support\Facades\Event;
```

Then add this line at the START of the `boot()` method body (before the existing RateLimiter definitions):

```php
        Event::listen(ProductStockedLow::class, SendLowStockNotification::class);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Inventory/LowStockNotificationTest.php`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full inventory suite to confirm no regression**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Inventory/`
Expected: PASS (StockLedger, ProductController, ConsumptionEngine, LowStockCrossing, LowStockNotification).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Infrastructure/Notifications/Notifications/LowStockForAdmin.php \
        apps/backend/app/Infrastructure/Notifications/Listeners/SendLowStockNotification.php \
        apps/backend/app/Providers/AppServiceProvider.php \
        apps/backend/tests/Feature/Inventory/LowStockNotificationTest.php
git commit -m "feat(inventory): notify owner+admin bell on low stock"
```

---

### Task 3: Admin frontend — route low-stock bell item to `/inventory`

**Files:**
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/notifications/page.tsx` (`handleClick`, lines 18–25)
- Modify: `apps/admin-v2/src/presentation/components/features/notifications/notification-dropdown.tsx` (`handleClick`, lines 18–25)

**Interfaces:**
- Consumes: notification entity field `actionType` (already mapped from backend `action_type` in `notification.mapper.ts`). The backend now emits `action_type: 'inventory'` (Task 2).

- [ ] **Step 1: Add the `inventory` branch in the full-page handler**

In `apps/admin-v2/src/presentation/app/(tenant)/notifications/page.tsx`, in `handleClick`, add after the existing `reservation_detail` block (currently lines 22–24):

```tsx
    if (notification.actionType === 'inventory') {
      router.push('/inventory');
    }
```

- [ ] **Step 2: Add the `inventory` branch in the bell-dropdown handler**

In `apps/admin-v2/src/presentation/components/features/notifications/notification-dropdown.tsx`, in `handleClick`, add after the existing `reservation_detail` block (currently lines 22–24):

```tsx
    if (notification.actionType === 'inventory') {
      router.push('/inventory');
    }
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add "apps/admin-v2/src/presentation/app/(tenant)/notifications/page.tsx" \
        apps/admin-v2/src/presentation/components/features/notifications/notification-dropdown.tsx
git commit -m "feat(admin): route low-stock notification to inventory"
```

---

## Self-Review

**Spec coverage:**
- Trigger in `StockLedger::record()`, crossing condition → Task 1. ✓
- Event + queued listener (layering) → Task 1 (event) + Task 2 (listener). ✓
- `LowStockForAdmin` `database`-only notification, correct payload → Task 2. ✓
- Recipients owner+tenant_admin, not cashier → Task 2 test asserts both directions. ✓
- Frontend `action_type: 'inventory'` → `/inventory` (both bell + page) → Task 3. ✓
- Tests: crossing/no-cross unit + delivery feature + payload + DB row → Tasks 1 & 2. ✓
- Out of scope (FCM/Reverb/email/digest) → none added. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". All code blocks are literal. ✓

**Type consistency:** `ProductStockedLow` props `(tenantId, productId, productName, onHand, stockMin, unit)` are dispatched with matching positional args in StockLedger (Task 1) and read by-name in the listener (Task 2). `LowStockForAdmin` constructor args match the listener's named-arg call. Frontend uses `actionType` (camel, per mapper) not `action_type`. ✓

## Notes for the implementer

- **Why dispatch after the transaction closure returns, not inside it:** if the movement rolls back, no event fires. The `&$crossedLow` / `&$finalOnHand` references carry the decision out of the closure.
- **Why the notification is not `ShouldQueue` but the listener is:** the listener is the async boundary. Under the test's `sync` queue both run inline, so the DB-row test is deterministic.
- **Sales/consumption from reservations are covered for free** — `ConsumptionEngine` calls `recordSale`/`recordConsumption`, which funnel through the same `record()`.
- **No number formatting** is applied to `onHand`/`stockMin` in the body; PHP interpolates `900.0` as `900` and `1000.0` as `1000`. If the client later wants unit-aware formatting, that's a follow-up.
