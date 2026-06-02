<?php

use App\Domain\Reservation\VariantSuggester;
use App\Domain\Tenant\BusinessTypeTemplates;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Collection;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'business_type' => 'car_wash',
    ]);
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->suggester = app(VariantSuggester::class);
});

function vsMakeVariant(string $tenantId, string $serviceId, string $label, float $price, int $sort = 0): ServiceVariantModel
{
    return ServiceVariantModel::create([
        'tenant_id' => $tenantId,
        'service_id' => $serviceId,
        'label' => $label,
        'price' => $price,
        'duration_min' => 30,
        'sort_order' => $sort,
        'is_active' => true,
    ]);
}

function vsMakeResource(string $tenantId, array $data): ClientResourceModel
{
    return ClientResourceModel::factory()->create([
        'tenant_id' => $tenantId,
        'client_id' => UserModel::factory()->create()->id,
        'data' => $data,
    ]);
}

test('sedán resource suggests the Pequeño variant on a car_wash service', function () {
    $resource = vsMakeResource($this->tenant->id, ['vehicle_type' => 'Sedán']);
    $variants = new Collection([
        vsMakeVariant($this->tenant->id, $this->service->id, 'Pequeño', 5, 0),
        vsMakeVariant($this->tenant->id, $this->service->id, 'Mediano', 8, 1),
        vsMakeVariant($this->tenant->id, $this->service->id, 'Grande', 12, 2),
    ]);

    // Refresh from DB so casts ('array') apply identically to a real
    // request, not the in-memory factory state.
    $fresh = $resource->fresh();

    $picked = $this->suggester->suggest(
        $fresh,
        $variants,
        BusinessTypeTemplates::getCustomFields('car_wash'),
    );

    expect($picked)->not->toBeNull();
    expect($picked->label)->toBe('Pequeño');
});

test('camioneta resource prefers the Camioneta variant when present', function () {
    $resource = vsMakeResource($this->tenant->id, ['vehicle_type' => 'Camioneta']);
    $variants = new Collection([
        vsMakeVariant($this->tenant->id, $this->service->id, 'Pequeño', 5, 0),
        vsMakeVariant($this->tenant->id, $this->service->id, 'Grande', 12, 1),
        vsMakeVariant($this->tenant->id, $this->service->id, 'Camioneta', 18, 2),
    ]);

    $picked = $this->suggester->suggest(
        $resource,
        $variants,
        BusinessTypeTemplates::getCustomFields('car_wash'),
    );

    expect($picked->label)->toBe('Camioneta');
});

test('returns null when the customer has not filled the affects_variant field yet', function () {
    $resource = vsMakeResource($this->tenant->id, ['plate' => 'XYZ-1234']); // no vehicle_type
    $variants = new Collection([
        vsMakeVariant($this->tenant->id, $this->service->id, 'Pequeño', 5),
    ]);

    $picked = $this->suggester->suggest(
        $resource,
        $variants,
        BusinessTypeTemplates::getCustomFields('car_wash'),
    );

    expect($picked)->toBeNull();
});

test('returns null when no variant label matches any of the mapped keywords', function () {
    $resource = vsMakeResource($this->tenant->id, ['vehicle_type' => 'SUV']);
    $variants = new Collection([
        vsMakeVariant($this->tenant->id, $this->service->id, 'Edición Limitada', 50),
    ]);

    $picked = $this->suggester->suggest(
        $resource,
        $variants,
        BusinessTypeTemplates::getCustomFields('car_wash'),
    );

    expect($picked)->toBeNull();
});
