<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

function carWashTenant(): TenantModel {
    return TenantModel::factory()->create([
        'business_type' => 'car_wash',
        'custom_fields' => [[
            'key' => 'vehicle_type', 'label' => 'Tipo de vehículo', 'type' => 'select',
            'required' => true, 'affects_variant' => true, 'locked' => true,
            'options' => ['Sedán', 'Hatchback', 'SUV', 'Camioneta', 'Camión / Van'],
        ]],
    ]);
}

it('persists valid vehicle_types on a variant', function () {
    $tenant = carWashTenant();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $user = UserModel::factory()->create();

    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    $res = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->postJson("/api/v1/services/{$service->id}/variants", [
            'label' => 'Auto', 'price' => 12, 'duration_min' => 40,
            'vehicle_types' => ['Sedán', 'Hatchback'],
        ]);

    $res->assertCreated();
    expect($res->json('data.vehicle_types'))->toEqual(['Sedán', 'Hatchback']);
});

it('rejects a vehicle_type not in the tenant options', function () {
    $tenant = carWashTenant();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $user = UserModel::factory()->create();

    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->postJson("/api/v1/services/{$service->id}/variants", [
            'label' => 'Auto', 'vehicle_types' => ['Moto'],
        ])
        ->assertStatus(422);
});
