<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type' => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('can create a walk-in service log', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->clientResource->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->user->id,
            'price_charged' => 12.50,
            'payment_method' => 'cash',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.status', 'in_progress');

    $this->assertDatabaseHas('service_logs', [
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
    ]);
});

test('can list service logs for today', function () {
    $today = now()->toDateString();
    ServiceLogModel::factory()->count(3)->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => $today,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs?date={$today}");

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can show a service log', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs/{$serviceLog->id}");

    $response->assertOk()
        ->assertJsonPath('data.id', $serviceLog->id);
});

test('can complete a service log', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'status' => 'in_progress',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/service-logs/{$serviceLog->id}/complete");

    $response->assertOk();

    $this->assertDatabaseHas('service_logs', [
        'id' => $serviceLog->id,
        'status' => 'completed',
    ]);
});

test('can get daily summary', function () {
    ServiceLogModel::factory()->count(5)->completed()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => now()->toDateString(),
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/service-logs/summary');

    $response->assertOk()
        ->assertJsonStructure(['data']);
});

test('create service log requires required fields', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/service-logs', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['client_resource_id', 'service_id', 'attended_by', 'price_charged', 'payment_method']);
});

test('can update service log items — replaces existing items', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'price_charged'      => 30.00,
    ]);

    $service2 = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$serviceLog->id}/items", [
            'items' => [
                [
                    'service_id'  => $this->service->id,
                    'variant_id'  => null,
                    'label'       => 'Lavada básica',
                    'qty'         => 1,
                    'unit_price'  => 15.00,
                ],
                [
                    'service_id'  => $service2->id,
                    'variant_id'  => null,
                    'label'       => 'Pulido',
                    'qty'         => 1,
                    'unit_price'  => 25.00,
                ],
            ],
        ]);

    $response->assertOk()
        ->assertJsonPath('data.price_charged', 40.0)
        ->assertJsonPath('data.service_id', $this->service->id)
        ->assertJsonCount(2, 'data.items');

    $this->assertDatabaseCount('service_log_items', 2);
    $this->assertDatabaseHas('service_log_items', [
        'service_log_id' => $serviceLog->id,
        'label'          => 'Pulido',
    ]);
});

test('update items replaces all — old items are gone', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'price_charged'      => 30.00,
    ]);

    // Seed an existing item
    \App\Infrastructure\Persistence\Models\ServiceLogItemModel::create([
        'tenant_id'      => $this->tenant->id,
        'service_log_id' => $serviceLog->id,
        'item_type'      => 'service_variant',
        'ref_id'         => $this->service->id,
        'label'          => 'Old item',
        'qty'            => 1,
        'unit_price'     => 30.00,
        'line_total'     => 30.00,
        'sort_order'     => 0,
    ]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$serviceLog->id}/items", [
            'items' => [
                [
                    'service_id'  => $this->service->id,
                    'variant_id'  => null,
                    'label'       => 'New item',
                    'qty'         => 1,
                    'unit_price'  => 20.00,
                ],
            ],
        ]);

    $this->assertDatabaseMissing('service_log_items', ['label' => 'Old item']);
    $this->assertDatabaseHas('service_log_items', ['label' => 'New item']);
});

test('update items rejects empty items array', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'price_charged'      => 30.00,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$serviceLog->id}/items", ['items' => []]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['items']);
});

test('can filter service logs by date', function () {
    $yesterday = now()->subDay()->toDateString();
    $today = now()->toDateString();

    ServiceLogModel::factory()->count(2)->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => $yesterday,
    ]);
    ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'log_date' => $today,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs?date={$yesterday}");

    $response->assertOk()
        ->assertJsonCount(2, 'data');
});
