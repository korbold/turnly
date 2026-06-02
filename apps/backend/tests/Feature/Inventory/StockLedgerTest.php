<?php

use App\Domain\Inventory\StockLedger;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ProductStockLevelModel;
use App\Infrastructure\Persistence\Models\StockMovementModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->ledger = app(StockLedger::class);
});

function makeProduct(string $tenantId, array $attrs = []): ProductModel
{
    return ProductModel::create(array_merge([
        'tenant_id' => $tenantId,
        'name'      => 'Shampoo',
        'type'      => 'consumable',
        'unit'      => 'ml',
        'cost'      => 0,
        'price'     => 0,
        'stock_min' => 0,
        'is_active' => true,
    ], $attrs));
}

test('recordPurchase raises on_hand and seeds avg_cost', function () {
    $p = makeProduct($this->tenant->id);

    $this->ledger->recordPurchase($p, qty: 1000, unitCost: 0.05);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(1000.0);
    expect((float) $level->avg_cost)->toBe(0.05);
    expect(StockMovementModel::where('product_id', $p->id)->count())->toBe(1);
});

test('weighted average cost blends across purchases', function () {
    $p = makeProduct($this->tenant->id);

    $this->ledger->recordPurchase($p, qty: 100, unitCost: 1.00);
    $this->ledger->recordPurchase($p, qty: 100, unitCost: 2.00);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(200.0);
    // (100*1 + 100*2) / 200 = 1.5
    expect((float) $level->avg_cost)->toBe(1.5);
});

test('consumption lowers on_hand but does not change avg_cost', function () {
    $p = makeProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 200, unitCost: 0.10);

    $this->ledger->recordConsumption($p, qty: 50);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(150.0);
    expect((float) $level->avg_cost)->toBe(0.10);
});

test('adjustment with positive delta raises on_hand', function () {
    $p = makeProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 100, unitCost: 1.00);

    $this->ledger->recordAdjustment($p, delta: 10);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(110.0);
});

test('adjustment with negative delta lowers on_hand', function () {
    $p = makeProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 100, unitCost: 1.00);

    $this->ledger->recordAdjustment($p, delta: -25);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(75.0);
});

test('sale lowers on_hand with negative qty in ledger', function () {
    $p = makeProduct($this->tenant->id, ['type' => 'sellable']);
    $this->ledger->recordPurchase($p, qty: 10, unitCost: 2.00);

    $this->ledger->recordSale($p, qty: 3);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(7.0);

    $sale = StockMovementModel::where('product_id', $p->id)->where('type', 'sale')->first();
    expect((float) $sale->qty)->toBe(-3.0);
});

test('return raises on_hand and is recorded in ledger', function () {
    $p = makeProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 10, unitCost: 1.00);
    $this->ledger->recordSale($p, qty: 5);

    $this->ledger->recordReturn($p, qty: 2);

    $level = ProductStockLevelModel::find($p->id);
    expect((float) $level->on_hand)->toBe(7.0);
});

test('zero or negative qty is rejected for purchase', function () {
    $p = makeProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 0, unitCost: 1.00);
})->throws(InvalidArgumentException::class);

test('soft-deleting a product preserves its movement history', function () {
    $p = makeProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 100, unitCost: 1.00);
    $this->ledger->recordConsumption($p, qty: 30);

    $p->delete();

    $count = StockMovementModel::where('product_id', $p->id)->count();
    expect($count)->toBe(2);
});
