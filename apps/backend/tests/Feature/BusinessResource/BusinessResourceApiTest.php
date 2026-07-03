<?php

use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

it('owner can list business resources', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    BusinessResourceModel::withoutGlobalScopes()->insert([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $tenant->id,
        'name'       => 'Estación 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/business-resources')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('owner can create a business resource', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->postJson('/api/v1/business-resources', [
            'name' => 'Silla Juan',
            'type' => 'person',
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Silla Juan')
        ->assertJsonPath('data.type', 'person');
});

it('owner can delete a business resource', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    $id = (string) \Illuminate\Support\Str::uuid();
    BusinessResourceModel::withoutGlobalScopes()->insert([
        'id'         => $id,
        'tenant_id'  => $tenant->id,
        'name'       => 'Sala 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->deleteJson("/api/v1/business-resources/{$id}")
        ->assertNoContent();

    expect(BusinessResourceModel::withoutGlobalScopes()->find($id))->toBeNull();
});
