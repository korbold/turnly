<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'settings' => ['allow_client_resource_selection' => true],
    ]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type' => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    for ($day = 0; $day <= 6; $day++) {
        AvailabilitySlotModel::create([
            'tenant_id'      => $this->tenant->id,
            'day_of_week'    => $day,
            'start_time'     => '00:00:00',
            'end_time'       => '23:59:00',
            'max_concurrent' => 10,
            'is_active'      => true,
        ]);
    }
});

it('stores and returns business_resource_id when passed in request', function () {
    $resource = BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Estación 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id'  => $this->clientResource->id,
            'service_id'          => $this->service->id,
            'scheduled_at'        => $scheduledAt->toIso8601String(),
            'business_resource_id' => $resource->id,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $resource->id);

    $this->assertDatabaseHas('reservations', [
        'business_resource_id' => $resource->id,
    ]);
});
