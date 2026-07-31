# Low-Stock Notification — Design

**Date:** 2026-07-31
**Status:** Approved, pending implementation
**Scope:** Backend (Laravel) + minor admin frontend touch

## Problem

Today "Stock bajo" is a purely passive visual flag: a badge + row highlight + filter chip on the Inventario page, all derived per-request from `on_hand <= stock_min` in `ProductResource`. Nothing proactively alerts anyone. The owner must open the inventory page and look. If a product runs below its minimum after a sale/consumption or adjustment, no one is told.

## Goal

When a stock movement drives a product from OK to below its minimum, notify the business admins in the in-app notification bell.

## Decisions (locked)

| Question | Decision |
|----------|----------|
| When to fire | **Only on threshold crossing** — the OK→low transition. No re-notify while already low. |
| Recipients | **owner + tenant_admin** (not cashier, not staff). |
| Channels | **In-app bell only** (`database` channel). No FCM push, no Reverb, no email. |

**Explicitly out of scope:** FCM push, realtime Reverb broadcast, email, daily digest cron. Each can be layered on later without reworking this.

## Architecture

### Trigger point — `StockLedger::record()`

`app/Domain/Inventory/StockLedger.php`. The private `record()` method is the single funnel for every stock movement: `recordPurchase / recordSale / recordConsumption / recordAdjustment / recordReturn` all pass through it, and it is the only place `on_hand` is written (reserve/release touch `reserved`, not `on_hand`). Callers today: `StockMovementController::store()` (manual Compra/Ajuste/Devolución) and `ConsumptionEngine` (reservation-completion Sale/Consumption). Hooking `record()` covers all of them with one edit.

Inside `record()`, `$oldOnHand` and `$newOnHand` are already computed (around lines 123-124/134), and `$product` (with `tenant_id`, `stock_min`, `id`, `name`, unit) is in scope.

### Crossing condition

```
$oldOnHand >= $product->stock_min  &&  $newOnHand < $product->stock_min
```

Only the OK→low transition passes. Already-low movements (e.g. -400 → -500 with min 1000) fail `$oldOnHand >= stock_min`, so no duplicate alert — dedup is intrinsic, no state to track. Movements that raise stock never satisfy `$newOnHand < stock_min` after being at/above. Fire **after** `$level->save()`, so a rolled-back transaction never emits.

### Dispatch — Event + Listener (respect layering)

`StockLedger` is the domain service; it must not call `Notification::send` directly. Instead, on a detected crossing it dispatches a Laravel event:

- **Event** `App\Events\ProductStockedLow` — carries the minimal payload: `tenantId`, `productId`, `productName`, `onHand`, `stockMin`, `unit`. Plain event (does **not** implement `ShouldBroadcast` — no Reverb this iteration).
- **Listener** `App\Infrastructure\Notifications\Listeners\SendLowStockNotification` (`implements ShouldQueue`) — resolves recipients and calls `Notification::send($admins, new LowStockForAdmin(...))`. Lives in Infrastructure, keeps the domain clean, covers both callers without duplication, and is independently testable. Wrap the send in try/catch + log so notification failure never breaks the movement flow (matches existing reservation/invoice call sites).

Registered in `EventServiceProvider` (`ProductStockedLow => [SendLowStockNotification]`).

### Notification — `LowStockForAdmin`

`app/Infrastructure/Notifications/Notifications/LowStockForAdmin.php`, mirroring `InvoiceAuthorized` but bell-only:

```php
public function via(object $notifiable): array {
    return ['database'];   // in-app bell only — no FcmChannel this iteration
}

public function toArray(object $notifiable): array {
    return [
        'title'       => '⚠️ Stock bajo',
        'body'        => "{$this->productName} bajo el mínimo ({$this->onHand}/{$this->stockMin} {$this->unit})",
        'action_type' => 'inventory',
        'action_id'   => $this->productId,
        'product_id'  => $this->productId,
        'tenant_id'   => $this->tenantId,
        'tenant_name' => $this->tenantName,
        'icon'        => 'inventory',
    ];
}
```

No `toFcm()` (would only matter if FCM were added later). `tenant_id`/`tenant_name` included for consistency with existing notifications and future FCM plan-gating.

### Recipient resolution

Copy the reservation/invoice pattern, minus cashier:

```php
$admins = TenantModel::find($tenantId)?->users()
    ->wherePivotIn('role', ['owner', 'tenant_admin'])
    ->wherePivot('is_active', true)
    ->get();
if ($admins && $admins->isNotEmpty()) {
    Notification::send($admins, new LowStockForAdmin(...));
}
```

Lives in the listener.

### Frontend (admin)

The bell already reads Laravel DB notifications via `NotificationController::index`, so a new `LowStockForAdmin` row surfaces automatically with its title/body/icon. Without Reverb the bell updates on its normal React Query refetch (poll / on navigation) — acceptable per the in-app-only decision.

Single touch: in the admin notification renderer/router (`apps/admin-v2/.../notifications` — the mapper/click handler that switches on `action_type`), add an `inventory` case that navigates to `/inventory`. If the existing switch has a sensible default, a low-stock row is still clickable; the case just makes the target correct.

## Data flow

```
movement (manual or reservation-consumption)
  → StockLedger::record()  [writes on_hand]
  → crossing? oldOnHand >= stock_min && newOnHand < stock_min
      → ProductStockedLow::dispatch(...)
          → SendLowStockNotification (queued listener)
              → resolve owner+tenant_admin (active)
              → Notification::send(LowStockForAdmin)  [database channel]
                  → notifications table row
                      → admin bell (on next refetch)
```

## Error handling

- Listener wraps send in try/catch + `Log::warning` — a notification failure never rolls back or breaks the stock movement.
- Event dispatch is after `$level->save()` within/after the transaction commit path so a failed movement emits nothing.
- Empty admin set (no active owner/admin) → no-op, no error.

## Testing

**Unit (StockLedger / crossing):**
- Movement dropping `on_hand` from `>= stock_min` to `< stock_min` dispatches `ProductStockedLow` once (assert via `Event::fake`).
- Movement while already below minimum (old `< stock_min`) dispatches nothing.
- Movement that raises stock dispatches nothing.
- Movement that lowers stock but stays `>= stock_min` dispatches nothing.

**Feature (end-to-end):**
- Registering a sale/adjustment that crosses the minimum creates a `notifications` DB row for owner and tenant_admin.
- The same crossing creates **no** row for a cashier or washer.
- Payload contains `action_type: 'inventory'` and the correct `product_id`.

## Files

**New:**
- `app/Events/ProductStockedLow.php`
- `app/Infrastructure/Notifications/Listeners/SendLowStockNotification.php`
- `app/Infrastructure/Notifications/Notifications/LowStockForAdmin.php`

**Edited:**
- `app/Domain/Inventory/StockLedger.php` — crossing detection + event dispatch in `record()`
- `EventServiceProvider` — register event→listener
- `apps/admin-v2/.../notifications` renderer/router — `action_type: 'inventory'` → `/inventory`

## Reference

Mirrors the existing DB-notification pattern (`InvoiceAuthorized`, `NewReservationForAdmin`) and recipient resolution (`SyncReservationInvoiceStatusJob::notifyAdmins`, `CreateReservationUseCase`). This iteration deliberately omits the Reverb/FCM half of that pattern (see 2026-07-27-realtime-invoice-reservation-design.md for the full realtime variant, available as a future upgrade).
