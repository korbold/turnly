<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function settingsOwner(TenantModel $tenant): UserModel
{
    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);
    return $owner;
}

test('PATCH tenant settings persists the permissions matrix and returns it', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);
    $owner = settingsOwner($tenant);

    $matrix = [
        'Cajero' => ['Reservas' => 'full', 'Clientes' => 'view', 'Config' => 'none'],
    ];

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson('/api/v1/tenant/settings', ['permissions' => $matrix])
        ->assertOk()
        ->assertJsonPath('data.permissions.Cajero.Reservas', 'full')
        ->assertJsonPath('data.permissions.Cajero.Clientes', 'view');

    // Round-trip: GET returns the persisted matrix
    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk()
        ->assertJsonPath('data.permissions.Cajero.Reservas', 'full');

    expect($tenant->fresh()->settings['permissions']['Cajero']['Reservas'])->toBe('full');
});

test('saving permissions does not clobber other settings', function () {
    $tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'settings' => ['iva_mode' => 'included'],
    ]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);
    $owner = settingsOwner($tenant);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson('/api/v1/tenant/settings', ['permissions' => ['Cajero' => ['Reservas' => 'full']]])
        ->assertOk()
        ->assertJsonPath('data.iva_mode', 'included')
        ->assertJsonPath('data.permissions.Cajero.Reservas', 'full');
});

test('tenant settings response includes a permissions key when unset', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);
    $owner = settingsOwner($tenant);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk()
        ->assertJsonStructure(['data' => ['permissions']]);
});
