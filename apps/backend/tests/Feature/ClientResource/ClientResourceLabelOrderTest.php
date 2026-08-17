<?php

use App\Infrastructure\Http\Resources\ClientResourceResource;
use App\Infrastructure\Persistence\Models\TenantModel;

/**
 * The label is built from a json column, so its key order is whatever MySQL
 * stored — which differs row to row and never leads with the plate. Order it by
 * the tenant's configured fields instead: the same order the cashier fills in
 * when registering, and reorderable by dragging in Configuración → Campos.
 */
function tenantWithFields(array $keys): TenantModel
{
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $tenant->forceFill([
        'custom_fields' => array_map(
            fn ($k) => ['key' => $k, 'label' => ucfirst($k), 'type' => 'text', 'required' => false],
            $keys,
        ),
    ])->save();

    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    return $tenant;
}

// ResolveTenantMiddleware binds `current_tenant` as a stdClass straight off the
// query builder — deliberately, to dodge a circular dependency — so in a real
// request custom_fields arrives as a raw json string, not a cast array. Binding
// an Eloquent model in a test hides that entirely.
test('orders the label when the tenant is the raw stdClass the middleware binds', function () {
    $row = (object) [
        'id' => 'tenant-1',
        'slug' => 'autospa',
        'custom_fields' => json_encode([
            ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true],
            ['key' => 'brand', 'label' => 'Marca', 'type' => 'text', 'required' => false],
            ['key' => 'color', 'label' => 'Color', 'type' => 'text', 'required' => false],
        ]),
    ];
    app()->instance('current_tenant', $row);

    expect(ClientResourceResource::labelFrom([
        'brand' => 'Toyota Hilux',
        'color' => 'Gris',
        'plate' => 'IBB9762',
    ]))->toBe('IBB9762 - Toyota Hilux - Gris');
});

test('orders the label by the configured fields, plate first', function () {
    tenantWithFields(['plate', 'brand', 'model', 'color', 'vehicle_type']);

    $label = ClientResourceResource::labelFrom([
        'brand' => 'Toyota Hilux',
        'color' => 'Gris',
        'plate' => 'IBB9762',
        'vehicle_type' => 'Camioneta',
    ]);

    expect($label)->toBe('IBB9762 - Toyota Hilux - Gris - Camioneta');
});

test('keeps the plate first when the row is missing a field', function () {
    tenantWithFields(['plate', 'brand', 'model', 'color', 'vehicle_type']);

    // No brand — this is the row that used to render "Negro - Jeep - ...".
    $label = ClientResourceResource::labelFrom([
        'color' => 'Negro',
        'model' => 'Jeep',
        'plate' => 'MBF3864',
        'vehicle_type' => 'Sedán',
    ]);

    expect($label)->toBe('MBF3864 - Jeep - Negro - Sedán');
});

test('appends values whose key is not configured, so nothing is lost', function () {
    tenantWithFields(['plate', 'brand']);

    $label = ClientResourceResource::labelFrom([
        'observacion' => 'Rayado',
        'brand' => 'Kia',
        'plate' => 'IBR9890',
    ]);

    expect($label)->toBe('IBR9890 - Kia - Rayado');
});

test('follows a non-vehicle field configuration', function () {
    tenantWithFields(['nombre', 'telefono']);

    expect(ClientResourceResource::labelFrom(['telefono' => '0987654321', 'nombre' => 'Ana']))
        ->toBe('Ana - 0987654321');
});

test('falls back to the stored order when the tenant configured no fields', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    expect(ClientResourceResource::labelFrom(['brand' => 'Kia', 'plate' => 'IBR9890']))
        ->toBe('Kia - IBR9890');
});

test('still handles json strings and empty data', function () {
    tenantWithFields(['plate', 'brand']);

    expect(ClientResourceResource::labelFrom('{"brand":"Kia","plate":"IBR9890"}'))
        ->toBe('IBR9890 - Kia');
    expect(ClientResourceResource::labelFrom([]))->toBe('Sin nombre');
    expect(ClientResourceResource::labelFrom(null))->toBe('Sin nombre');
});
