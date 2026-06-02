<?php

use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Inventory\StockLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ProductStockLevelModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantConsumptionModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\StockMovementModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->ledger = app(StockLedger::class);
    $this->engine = app(ConsumptionEngine::class);
});

function seedProduct(string $tenantId, string $name, float $initial = 1000): ProductModel
{
    $p = ProductModel::create([
        'tenant_id' => $tenantId,
        'name'      => $name,
        'type'      => 'consumable',
        'unit'      => 'ml',
    ]);
    app(StockLedger::class)->recordPurchase($p, qty: $initial, unitCost: 0.05);
    return $p;
}

function buildReservation(string $tenantId, string $serviceId, ?string $variantId): ReservationModel
{
    $client = UserModel::factory()->create();
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenantId,
        'client_id' => $client->id,
    ]);

    return ReservationModel::create([
        'tenant_id'          => $tenantId,
        'client_id'          => $client->id,
        'client_resource_id' => $resource->id,
        'service_id'         => $serviceId,
        'service_variant_id' => $variantId,
        'scheduled_at'       => now()->addHour(),
        'estimated_end'      => now()->addHours(2),
        'status'             => 'completed',
        'created_by'         => $client->id,
    ]);
}

test('consumption engine debits stock per BOM line', function () {
    $shampoo = seedProduct($this->tenant->id, 'Shampoo');
    $cera    = seedProduct($this->tenant->id, 'Cera');

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id'    => $this->tenant->id,
        'service_id'   => $service->id,
        'label'        => 'Mediano',
        'price'        => 8,
        'duration_min' => 45,
    ]);
    ServiceVariantConsumptionModel::create(['service_variant_id' => $variant->id, 'product_id' => $shampoo->id, 'qty' => 100]);
    ServiceVariantConsumptionModel::create(['service_variant_id' => $variant->id, 'product_id' => $cera->id,    'qty' => 40]);

    $reservation = buildReservation($this->tenant->id, $service->id, $variant->id);

    $this->engine->applyForReservation($reservation);

    expect((float) ProductStockLevelModel::find($shampoo->id)->on_hand)->toBe(900.0);
    expect((float) ProductStockLevelModel::find($cera->id)->on_hand)->toBe(960.0);
});

test('consumption engine is idempotent', function () {
    $shampoo = seedProduct($this->tenant->id, 'Shampoo');

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id'  => $this->tenant->id,
        'service_id' => $service->id,
        'label'      => 'Default',
    ]);
    ServiceVariantConsumptionModel::create(['service_variant_id' => $variant->id, 'product_id' => $shampoo->id, 'qty' => 50]);

    $reservation = buildReservation($this->tenant->id, $service->id, $variant->id);

    $this->engine->applyForReservation($reservation);
    $this->engine->applyForReservation($reservation->fresh());

    expect((float) ProductStockLevelModel::find($shampoo->id)->on_hand)->toBe(950.0);
    expect(StockMovementModel::where('product_id', $shampoo->id)->where('type', 'consumption')->count())->toBe(1);
});

test('engine falls back to default variant when reservation has no variant_id', function () {
    $shampoo = seedProduct($this->tenant->id, 'Shampoo');

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $default = ServiceVariantModel::create([
        'tenant_id'  => $this->tenant->id,
        'service_id' => $service->id,
        'label'      => 'Default',
    ]);
    ServiceVariantConsumptionModel::create(['service_variant_id' => $default->id, 'product_id' => $shampoo->id, 'qty' => 25]);

    $reservation = buildReservation($this->tenant->id, $service->id, null);

    $this->engine->applyForReservation($reservation);

    expect((float) ProductStockLevelModel::find($shampoo->id)->on_hand)->toBe(975.0);
});

test('engine marks reservation applied even when variant has no BOM lines', function () {
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id'  => $this->tenant->id,
        'service_id' => $service->id,
        'label'      => 'Empty',
    ]);

    $reservation = buildReservation($this->tenant->id, $service->id, $variant->id);

    $this->engine->applyForReservation($reservation);

    expect($reservation->fresh()->consumption_applied_at)->not->toBeNull();
});
