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
