<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('can list services', function () {
    ServiceModel::factory()->count(3)->create(['tenant_id' => $this->tenant->id]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/services');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can create service', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/services', [
            'name' => 'Lavado Premium',
            'price' => 15.00,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.name', 'Lavado Premium');

    $this->assertDatabaseHas('services', [
        'name' => 'Lavado Premium',
        'tenant_id' => $this->tenant->id,
    ]);
});

test('can update service', function () {
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/services/{$service->id}", [
            'name' => $service->name,
            'price' => 20.00,
        ]);

    $response->assertOk()
        ->assertJsonPath('data.price', '20.00');
});

test('can delete service', function () {
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->deleteJson("/api/v1/services/{$service->id}");

    $response->assertOk();

    // Service should be soft-deleted (not hard deleted)
    $this->assertSoftDeleted('services', ['id' => $service->id]);
});

test('create service requires name and price', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/services', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'price']);
});

test('list services returns empty array when no services exist', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/services');

    $response->assertOk()
        ->assertJsonCount(0, 'data');
});
