<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-08-17 09:00:00'));

    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'custom_fields' => [
            ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true],
            [
                'key' => 'vehicle_type',
                'label' => 'Tipo de vehículo',
                'type' => 'select',
                'required' => true,
                'options' => ['Hatchback', 'Camioneta'],
                'affects_variant' => true,
            ],
        ],
    ]);

    // The public page only exists once the tenant has gallery content.
    TenantImageModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'url' => 'https://example.com/a.jpg',
        'sort_order' => 0,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    // Default first by sort order — the one the old code always picked.
    $this->small = ServiceVariantModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'service_id' => $this->service->id,
        'label' => 'Default',
        'price' => 7.00,
        'duration_min' => 30,
        'vehicle_types' => ['Hatchback'],
        'is_active' => true,
        'sort_order' => 0,
    ]);

    $this->big = ServiceVariantModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'service_id' => $this->service->id,
        'label' => 'Camioneta',
        'price' => 18.00,
        'duration_min' => 60,
        'vehicle_types' => ['Camioneta'],
        'is_active' => true,
        'sort_order' => 1,
    ]);

    AvailabilitySlotModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'day_of_week' => (int) Carbon::parse('2026-08-18')->format('N') - 1,
        'start_time' => '08:00',
        'end_time' => '20:00',
        'max_concurrent' => 3,
        'is_active' => true,
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

afterEach(fn () => Carbon::setTestNow());

function bookAs(string $vehicleType): string
{
    $res = test()->postJson("/api/v1/public/tenants/" . test()->tenant->slug . "/book", [
        'service_id' => test()->service->id,
        'scheduled_at' => '2026-08-18T10:00:00-05:00',
        'client_name' => 'Danny',
        'client_email' => strtolower($vehicleType) . '@example.com',
        'client_phone' => '0999999999',
        'client_resource_data' => ['plate' => 'IBF9890', 'vehicle_type' => $vehicleType],
    ]);

    $res->assertStatus(201);

    return $res->json('data.reservation_id') ?? $res->json('data.id');
}

// The web sends service_id with no variant, so the price came from the
// "Default" variant no matter what the customer picked. A Camioneta was
// charged the Hatchback rate.
test('the booking picks the variant matching the vehicle type', function () {
    $id = bookAs('Camioneta');

    $item = ReservationItemModel::where('reservation_id', $id)->first();

    expect($item)->not->toBeNull()
        ->and((float) $item->unit_price)->toBe(18.0)
        ->and($item->ref_id)->toBe($this->big->id);
});

test('the matching vehicle type also sets the duration', function () {
    $id = bookAs('Camioneta');

    $reservation = ReservationModel::withoutGlobalScopes()->find($id);

    expect(Carbon::parse($reservation->scheduled_at)->diffInMinutes(Carbon::parse($reservation->estimated_end)))
        ->toBe(60.0);
});

test('a vehicle type with no match falls back to the default variant', function () {
    $id = bookAs('Hatchback');

    $item = ReservationItemModel::where('reservation_id', $id)->first();

    expect((float) $item->unit_price)->toBe(7.0);
});

// Tenants that never ticked "affects_variant" still have variants that
// declare the types they serve; charging the default price there is the
// same billing error with a different cause.
test('the vehicle type is matched even when no field is flagged', function () {
    $this->tenant->update(['custom_fields' => [
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true],
        [
            'key' => 'vehicle_type',
            'label' => 'Tipo de vehículo',
            'type' => 'select',
            'required' => true,
            'options' => ['Hatchback', 'Camioneta'],
        ],
    ]]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $id = bookAs('Camioneta');

    expect((float) ReservationItemModel::where('reservation_id', $id)->value('unit_price'))->toBe(18.0);
});
