<?php

use App\Domain\Reservation\VariantSuggester;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Support\Collection;

function suggesterFields(): array {
    return [[
        'key' => 'vehicle_type', 'affects_variant' => true,
        'options' => ['Sedán', 'Hatchback', 'SUV', 'Camioneta'],
    ]];
}

function vsVariant(string $label, array $types, int $sort = 0, bool $active = true): ServiceVariantModel {
    return new ServiceVariantModel([
        'label' => $label, 'vehicle_types' => $types, 'sort_order' => $sort, 'is_active' => $active,
    ]);
}

it('matches a variant whose vehicle_types contains the resource value', function () {
    $resource = new ClientResourceModel(['data' => ['vehicle_type' => 'Hatchback']]);
    $variants = new Collection([
        vsVariant('Auto', ['Sedán', 'Hatchback'], 0),
        vsVariant('Camioneta/SUV', ['SUV', 'Camioneta'], 1),
    ]);

    $result = (new VariantSuggester())->suggest($resource, $variants, suggesterFields());
    expect($result?->label)->toBe('Auto');
});

it('returns null when no variant covers the value', function () {
    $resource = new ClientResourceModel(['data' => ['vehicle_type' => 'Camión / Van']]);
    $variants = new Collection([vsVariant('Auto', ['Sedán'], 0)]);
    expect((new VariantSuggester())->suggest($resource, $variants, suggesterFields()))->toBeNull();
});

it('returns null when the resource has no segmentation value', function () {
    $resource = new ClientResourceModel(['data' => ['brand' => 'Kia']]);
    $variants = new Collection([vsVariant('Auto', ['Sedán'], 0)]);
    expect((new VariantSuggester())->suggest($resource, $variants, suggesterFields()))->toBeNull();
});

it('skips inactive variants and prefers lower sort_order', function () {
    $resource = new ClientResourceModel(['data' => ['vehicle_type' => 'SUV']]);
    $variants = new Collection([
        vsVariant('Inactiva', ['SUV'], 0, false),
        vsVariant('Grande', ['SUV'], 2),
        vsVariant('Mediano', ['SUV'], 1),
    ]);
    expect((new VariantSuggester())->suggest($resource, $variants, suggesterFields())?->label)->toBe('Mediano');
});
