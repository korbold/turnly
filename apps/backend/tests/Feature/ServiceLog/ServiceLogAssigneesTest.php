<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogAssigneesTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 10.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman Paspuel', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis Chalá', 'position' => 'dryer',
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('a service can be registered with no assignees at all', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.washed_by', null)
        ->assertJsonPath('data.dried_by', null);
});

test('a service can be registered with both assignees', function () {
    $response = ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $this->washer->id,
            'dried_by'           => $this->dryer->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(201);

    expect($response->json('data.washed_by'))->toBe($this->washer->id);
    expect($response->json('data.dried_by'))->toBe($this->dryer->id);
});

test('the detail endpoint resolves the assignee names', function () {
    $id = ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $this->washer->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])->json('data.id');

    $response = ($this->as)($this->owner)
        ->getJson("/api/v1/service-logs/{$id}")
        ->assertOk()
        ->assertJsonPath('data.washer.name', 'Federman Paspuel');

    // assertJsonPath('data.dryer', null) would pass whether the key is null
    // OR absent entirely — this repo has been bitten by exactly that vacuous
    // assertion before. Prove the key exists AND is null.
    $body = $response->json('data');
    expect($body)->toHaveKey('dryer');
    expect($body['dryer'])->toBeNull();
});

test('the list endpoint carries the assignee names for the row', function () {
    ($this->as)($this->owner)->postJson('/api/v1/service-logs', [
        'client_resource_id' => $this->resource->id,
        'attended_by'        => $this->owner->id,
        'washed_by'          => $this->washer->id,
        'dried_by'           => $this->dryer->id,
        'items'              => [[
            'service_id' => $this->service->id, 'label' => 'Lavado',
            'qty' => 1, 'unit_price' => 10.00,
        ]],
        'payment_method' => 'cash',
    ]);

    ($this->as)($this->owner)
        ->getJson('/api/v1/service-logs')
        ->assertOk()
        ->assertJsonPath('data.0.washer.name', 'Federman Paspuel')
        ->assertJsonPath('data.0.dryer.name', 'Luis Chalá');
});

test('staff from another tenant is rejected at registration', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    $alien = ServiceStaffModel::create([
        'tenant_id' => $other->id, 'name' => 'Ajeno', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $alien->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});
