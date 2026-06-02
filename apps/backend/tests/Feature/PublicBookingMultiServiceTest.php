<?php

use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'slug' => 'test-shop',
    ]);
    // Public booking gates on the presence of a custom page image.
    TenantImageModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'storage_path' => '/test.jpg',
        'url' => 'https://example.com/test.jpg',
        'sort_order' => 0,
    ]);
});

function makeVariant(string $tenantId, string $label, float $price, int $duration): ServiceVariantModel
{
    $service = ServiceModel::factory()->create(['tenant_id' => $tenantId]);
    return ServiceVariantModel::create([
        'tenant_id' => $tenantId,
        'service_id' => $service->id,
        'label' => $label,
        'price' => $price,
        'duration_min' => $duration,
    ]);
}

test('public book accepts multiple service variants and creates items', function () {
    $v1 = makeVariant($this->tenant->id, 'Mediano', 8, 30);
    $v2 = makeVariant($this->tenant->id, 'Sintético 5W-30', 30, 25);

    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'items' => [
            ['service_variant_id' => $v1->id, 'qty' => 1],
            ['service_variant_id' => $v2->id, 'qty' => 1],
        ],
        'scheduled_at' => now()->addHours(2)->toIso8601String(),
        'client_name' => 'Juan Pérez',
        'client_email' => 'juan@example.com',
        'client_resource_data' => [
            'plate' => 'ABC1234', 'brand' => 'Toyota', 'model' => 'Corolla', 'type' => 'sedan',
        ],
    ]);

    $response->assertCreated();
    $reservation = ReservationModel::withoutGlobalScopes()->latest('created_at')->first();
    expect(ReservationItemModel::where('reservation_id', $reservation->id)->count())->toBe(2);

    // estimated_end - scheduled_at must equal sum of durations (55 min).
    $start = new \DateTime($reservation->scheduled_at);
    $end = new \DateTime($reservation->estimated_end);
    $diff = (int) (($end->getTimestamp() - $start->getTimestamp()) / 60);
    expect($diff)->toBe(55);
});

test('legacy service_id-only booking still works', function () {
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Default',
        'price' => 15,
        'duration_min' => 40,
    ]);

    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'service_id' => $service->id,
        'scheduled_at' => now()->addHours(2)->toIso8601String(),
        'client_name' => 'Juan Pérez',
        'client_email' => 'juan@example.com',
        'client_resource_data' => [
            'plate' => 'XYZ1234', 'brand' => 'Toyota', 'model' => 'Corolla', 'type' => 'sedan',
        ],
    ]);

    $response->assertCreated();
});

test('book rejects items from another tenant', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    $foreign = makeVariant($other->id, 'X', 5, 10);

    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'items' => [['service_variant_id' => $foreign->id, 'qty' => 1]],
        'scheduled_at' => now()->addHours(2)->toIso8601String(),
        'client_name' => 'Juan',
        'client_email' => 'juan2@example.com',
    ]);

    $response->assertStatus(422);
});
