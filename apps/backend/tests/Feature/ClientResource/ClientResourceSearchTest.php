<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->cashier = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->cashier->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    $this->client = UserModel::factory()->create(['name' => 'Federman Paspuel']);
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->client->id,
        'role'      => 'client',
        'is_active' => true,
    ]);

    ClientResourceModel::create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->client->id,
        'data'      => [
            'plate'        => 'IBF7520',
            'brand'        => 'Toyota',
            'color'        => 'Celeste',
            'model'        => 'RAIZE',
            'vehicle_type' => 'SUV',
        ],
    ]);
});

function searchResources(string $term)
{
    return test()
        ->actingAs(test()->cashier)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/client-resources?all=1&search=' . urlencode($term));
}

test('finds a resource by plate regardless of case', function (string $term) {
    searchResources($term)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.data.plate', 'IBF7520');
})->with([
    'uppercase'  => ['IBF'],
    'lowercase'  => ['ibf'],
    'mixed case' => ['Ibf75'],
]);

test('finds a resource by a custom-field value regardless of case', function (string $term) {
    searchResources($term)
        ->assertOk()
        ->assertJsonCount(1, 'data');
})->with([
    'brand lowercase' => ['toyota'],
    'brand uppercase' => ['TOYOTA'],
    'model lowercase' => ['raize'],
]);

test('finds a resource by owner name regardless of case', function () {
    searchResources('federman')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('returns nothing for a term that matches no resource', function () {
    searchResources('zzz999')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
