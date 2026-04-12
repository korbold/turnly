<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

test('resolves tenant from X-Tenant header', function () {
    TenantModel::factory()->create(['slug' => 'demo', 'status' => 'active']);
    $user = UserModel::factory()->create();

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'demo')
        ->getJson('/api/v1/services');

    $response->assertOk(); // TenantScope applied, returns empty list
});

test('returns 404 for unknown tenant', function () {
    $user = UserModel::factory()->create();

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'nonexistent')
        ->getJson('/api/v1/services');

    $response->assertStatus(404)
        ->assertJsonPath('error.code', 'TENANT_NOT_FOUND');
});

test('returns 403 for suspended tenant', function () {
    TenantModel::factory()->create(['slug' => 'suspended', 'status' => 'suspended']);
    $user = UserModel::factory()->create();

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'suspended')
        ->getJson('/api/v1/services');

    $response->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_SUSPENDED');
});

test('tenant scoped request only returns data for that tenant', function () {
    $tenant1 = TenantModel::factory()->create(['status' => 'active']);
    $tenant2 = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();

    // Create services for both tenants (bypassing global scope)
    \App\Infrastructure\Persistence\Models\ServiceModel::withoutGlobalScopes()->insert([
        [
            'id' => \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant1->id,
            'name' => 'Service T1',
            'price' => 10.00,
            'duration_minutes' => 20,
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'id' => \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant2->id,
            'name' => 'Service T2',
            'price' => 15.00,
            'duration_minutes' => 30,
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);

    // Request as tenant1
    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant1->slug)
        ->getJson('/api/v1/services');

    $response->assertOk();
    // Data should only contain tenant1's service
    $data = $response->json('data');
    expect(count($data))->toBe(1);
    expect($data[0]['name'])->toBe('Service T1');
});
