<?php

use App\Domain\Inventory\StockLedger;
use App\Infrastructure\Notifications\Notifications\LowStockForAdmin;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ProductStockLevelModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\DB;
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

    Notification::assertSentTo($owner, LowStockForAdmin::class, function ($notif) use ($p, $owner) {
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

test('crossing inside an outer transaction that commits notifies the owner', function () {
    Notification::fake();
    $owner = UserModel::factory()->create();
    attachRole($this->tenant->id, $owner->id, 'owner');

    $p = notifProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 1500, unitCost: 0.01); // 1500, above min

    DB::transaction(function () use ($p) {
        $this->ledger->recordConsumption($p, qty: 600); // 900 -> crosses below 1000
    });

    Notification::assertSentTo($owner, LowStockForAdmin::class);
});

test('crossing inside an outer transaction that rolls back does not notify', function () {
    Notification::fake();
    $owner = UserModel::factory()->create();
    attachRole($this->tenant->id, $owner->id, 'owner');

    $p = notifProduct($this->tenant->id);
    $this->ledger->recordPurchase($p, qty: 1500, unitCost: 0.01); // 1500, above min

    try {
        DB::transaction(function () use ($p) {
            $this->ledger->recordConsumption($p, qty: 600); // would cross to 900
            throw new RuntimeException('simulate a later BOM line failing');
        });
    } catch (RuntimeException $e) {
        // expected — outer transaction rolls back
    }

    Notification::assertNothingSent();
    expect((float) ProductStockLevelModel::find($p->id)->on_hand)->toBe(1500.0);
});
