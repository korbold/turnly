<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\VehicleModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('can create vehicle', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/vehicles', [
            'plate' => 'PBA-1234',
            'brand' => 'Toyota',
            'model' => 'Corolla',
            'color' => 'Blanco',
            'type' => 'sedan',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.plate', 'PBA-1234');

    $this->assertDatabaseHas('vehicles', [
        'plate' => 'PBA-1234',
        'tenant_id' => $this->tenant->id,
    ]);
});

test('can create vehicle with minimal data', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/vehicles', [
            'plate' => 'ABC-9999',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.plate', 'ABC-9999');
});

test('cannot create vehicle without plate', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/vehicles', [
            'brand' => 'Toyota',
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['plate']);
});

test('can list vehicles', function () {
    VehicleModel::factory()->count(3)->create([
        'tenant_id' => $this->tenant->id,
        'owner_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/vehicles');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can show vehicle detail', function () {
    $vehicle = VehicleModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'owner_id' => $this->user->id,
        'plate' => 'XYZ-5678',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/vehicles/{$vehicle->id}");

    $response->assertOk()
        ->assertJsonPath('data.plate', 'XYZ-5678');
});

test('cannot create duplicate plate in same tenant', function () {
    VehicleModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'owner_id' => $this->user->id,
        'plate' => 'PBA-1234',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/vehicles', [
            'plate' => 'PBA-1234',
        ]);

    $response->assertStatus(422);
});

test('can get vehicle wash history', function () {
    $vehicle = VehicleModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'owner_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/vehicles/{$vehicle->id}/history");

    $response->assertOk()
        ->assertJsonStructure(['data']);
});
