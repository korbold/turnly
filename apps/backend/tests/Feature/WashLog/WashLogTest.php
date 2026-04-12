<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\VehicleModel;
use App\Infrastructure\Persistence\Models\WashLogModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->vehicle = VehicleModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'owner_id' => $this->user->id,
        'type' => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('can create a walk-in wash log', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/wash-logs', [
            'vehicle_id' => $this->vehicle->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->user->id,
            'price_charged' => 12.50,
            'payment_method' => 'cash',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.status', 'in_progress');

    $this->assertDatabaseHas('wash_logs', [
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
    ]);
});

test('can list wash logs for today', function () {
    $today = now()->toDateString();
    WashLogModel::factory()->count(3)->create([
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => $today,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/wash-logs?date={$today}");

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can show a wash log', function () {
    $washLog = WashLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/wash-logs/{$washLog->id}");

    $response->assertOk()
        ->assertJsonPath('data.id', $washLog->id);
});

test('can complete a wash log', function () {
    $washLog = WashLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'status' => 'in_progress',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/wash-logs/{$washLog->id}/complete");

    $response->assertOk();

    $this->assertDatabaseHas('wash_logs', [
        'id' => $washLog->id,
        'status' => 'completed',
    ]);
});

test('can get daily summary', function () {
    WashLogModel::factory()->count(5)->completed()->create([
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => now()->toDateString(),
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/wash-logs/summary');

    $response->assertOk()
        ->assertJsonStructure(['data']);
});

test('create wash log requires required fields', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/wash-logs', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['vehicle_id', 'service_id', 'attended_by', 'price_charged', 'payment_method']);
});

test('can filter wash logs by date', function () {
    $yesterday = now()->subDay()->toDateString();
    $today = now()->toDateString();

    WashLogModel::factory()->count(2)->create([
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => $yesterday,
    ]);
    WashLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'vehicle_id' => $this->vehicle->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => $today,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/wash-logs?date={$yesterday}");

    $response->assertOk()
        ->assertJsonCount(2, 'data');
});
