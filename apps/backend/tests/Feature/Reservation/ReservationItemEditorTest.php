<?php

use App\Domain\Inventory\StockLedger;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\ReservationItemEditor;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ProductStockLevelModel;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantConsumptionModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->editor = app(ReservationItemEditor::class);
    $this->ledger = app(StockLedger::class);
});

function p3_seedProduct(string $tenantId, string $name, float $initial = 1000): ProductModel
{
    $p = ProductModel::create([
        'tenant_id' => $tenantId, 'name' => $name,
        'type' => 'consumable', 'unit' => 'ml',
    ]);
    app(StockLedger::class)->recordPurchase($p, qty: $initial, unitCost: 0.05);
    return $p;
}

function p3_makeReservation(string $tenantId, string $status = 'confirmed'): ReservationModel
{
    $client = UserModel::factory()->create();
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenantId, 'client_id' => $client->id,
    ]);
    $service = ServiceModel::factory()->create(['tenant_id' => $tenantId]);
    return ReservationModel::create([
        'tenant_id' => $tenantId,
        'client_id' => $client->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'scheduled_at' => now()->addHour(),
        'estimated_end' => now()->addHours(2),
        'status' => $status,
        'created_by' => $client->id,
    ]);
}

test('adding a service variant creates an item and an audit row', function () {
    $reservation = p3_makeReservation($this->tenant->id);
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Mediano', 'price' => 8,
    ]);

    $item = $this->editor->addServiceVariant($reservation, $variant, qty: 1, userId: $this->user->id);

    expect(ReservationItemModel::where('reservation_id', $reservation->id)->count())->toBe(1);
    expect((float) $item->line_total)->toBe(8.0);
    expect(ReservationItemChangeModel::where('reservation_id', $reservation->id)
        ->where('action', 'added')->count())->toBe(1);
});

test('check_in reservation reserves stock when adding a variant with BOM', function () {
    $shampoo = p3_seedProduct($this->tenant->id, 'Shampoo');

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Default', 'price' => 5,
    ]);
    ServiceVariantConsumptionModel::create([
        'service_variant_id' => $variant->id,
        'product_id' => $shampoo->id,
        'qty' => 100,
    ]);

    $reservation = p3_makeReservation($this->tenant->id, ReservationStatus::CheckedIn->value);

    $this->editor->addServiceVariant($reservation, $variant, qty: 1, userId: $this->user->id);

    $level = ProductStockLevelModel::find($shampoo->id);
    expect((float) $level->on_hand)->toBe(1000.0);
    expect((float) $level->reserved)->toBe(100.0);
});

test('removing an item is blocked once the wash is in_progress', function () {
    $reservation = p3_makeReservation($this->tenant->id, ReservationStatus::InProgress->value);
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id, 'label' => 'X', 'price' => 5,
    ]);
    $item = ReservationItemModel::create([
        'tenant_id' => $this->tenant->id,
        'reservation_id' => $reservation->id,
        'item_type' => 'service_variant',
        'ref_id' => $variant->id,
        'label' => 'X', 'qty' => 1, 'unit_price' => 5, 'line_total' => 5,
    ]);

    expect(fn () => $this->editor->remove($reservation, $item, $this->user->id, 'test'))
        ->toThrow(RuntimeException::class);
});

test('price override only allowed during checked_in', function () {
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $variant = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id, 'label' => 'X', 'price' => 10,
    ]);

    $confirmed = p3_makeReservation($this->tenant->id, 'confirmed');
    $confirmedItem = $this->editor->addServiceVariant($confirmed, $variant, 1, $this->user->id);

    expect(fn () => $this->editor->overridePrice($confirmed, $confirmedItem, 8, $this->user->id, 'descuento'))
        ->toThrow(RuntimeException::class);

    $checked = p3_makeReservation($this->tenant->id, ReservationStatus::CheckedIn->value);
    $checkedItem = $this->editor->addServiceVariant($checked, $variant, 1, $this->user->id);
    $updated = $this->editor->overridePrice($checked, $checkedItem, 8, $this->user->id, 'descuento');
    expect((float) $updated->unit_price)->toBe(8.0);
});

test('state machine allows confirmed→checked_in→in_progress', function () {
    expect(ReservationStatus::Confirmed->canTransitionTo(ReservationStatus::CheckedIn))->toBeTrue();
    expect(ReservationStatus::CheckedIn->canTransitionTo(ReservationStatus::InProgress))->toBeTrue();
    expect(ReservationStatus::Pending->canTransitionTo(ReservationStatus::CheckedIn))->toBeFalse();
    expect(ReservationStatus::Completed->canTransitionTo(ReservationStatus::CheckedIn))->toBeFalse();
});
