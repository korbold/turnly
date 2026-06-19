<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'settings' => ['allow_client_resource_selection' => false],
    ]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
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

it('auto_assigns first available resource ordered by sort_order', function () {
    $r1 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);
    BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 2', 'type' => 'physical', 'is_active' => true, 'sort_order' => 1,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $r1->id);
});

it('assigns second resource when first is busy in the same slot', function () {
    $r1 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);
    $r2 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 2', 'type' => 'physical', 'is_active' => true, 'sort_order' => 1,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);
    $slotDuration = $this->tenant->settings['slot_duration_minutes'] ?? 30;
    $estimatedEnd = (clone $scheduledAt)->addMinutes($slotDuration);

    // Pre-book resource 1 in the same slot
    ReservationModel::factory()->create([
        'tenant_id'            => $this->tenant->id,
        'client_id'            => $this->user->id,
        'client_resource_id'   => $this->clientResource->id,
        'service_id'           => $this->service->id,
        'created_by'           => $this->user->id,
        'business_resource_id' => $r1->id,
        'scheduled_at'         => $scheduledAt,
        'estimated_end'        => $estimatedEnd,
        'status'               => 'pending',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $r2->id);
});

it('returns 409 when all resources are occupied in the requested slot', function () {
    $slotDuration = $this->tenant->settings['slot_duration_minutes'] ?? 30;
    $scheduledAt  = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);
    $estimatedEnd = (clone $scheduledAt)->addMinutes($slotDuration);

    foreach (['Estación 1', 'Estación 2'] as $i => $name) {
        $resource = BusinessResourceModel::create([
            'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
            'name' => $name, 'type' => 'physical', 'is_active' => true, 'sort_order' => $i,
        ]);
        ReservationModel::factory()->create([
            'tenant_id'            => $this->tenant->id,
            'client_id'            => $this->user->id,
            'client_resource_id'   => $this->clientResource->id,
            'service_id'           => $this->service->id,
            'created_by'           => $this->user->id,
            'business_resource_id' => $resource->id,
            'scheduled_at'         => $scheduledAt,
            'estimated_end'        => $estimatedEnd,
            'status'               => 'pending',
        ]);
    }

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(409);
    $response->assertJsonPath('error.code', 'NO_RESOURCE_AVAILABLE');
});

it('creates reservation without business_resource_id when tenant has no resources', function () {
    // No BusinessResourceModel records for this tenant

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id'         => $this->service->id,
            'scheduled_at'       => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', null);
});

it('uses client-provided business_resource_id when allow_client_resource_selection is true', function () {
    $settings = $this->tenant->settings;
    $settings['allow_client_resource_selection'] = true;
    $this->tenant->update(['settings' => $settings]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $r1 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);
    $r2 = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 2', 'type' => 'physical', 'is_active' => true, 'sort_order' => 1,
    ]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    // Client explicitly picks r2 (not r1 which would be auto-assigned)
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id'   => $this->clientResource->id,
            'service_id'           => $this->service->id,
            'scheduled_at'         => $scheduledAt->toIso8601String(),
            'business_resource_id' => $r2->id,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.business_resource_id', $r2->id);
});

it('rejects client-selected resource when it is already occupied', function () {
    $settings = $this->tenant->settings;
    $settings['allow_client_resource_selection'] = true;
    $this->tenant->update(['settings' => $settings]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $resource = BusinessResourceModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Estación 1', 'type' => 'physical', 'is_active' => true, 'sort_order' => 0,
    ]);

    $slotDuration  = $this->tenant->settings['slot_duration_minutes'] ?? 30;
    $scheduledAt   = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);
    $estimatedEnd  = (clone $scheduledAt)->addMinutes($slotDuration);

    // Pre-book the resource
    ReservationModel::factory()->create([
        'tenant_id'            => $this->tenant->id,
        'client_id'            => $this->user->id,
        'client_resource_id'   => $this->clientResource->id,
        'service_id'           => $this->service->id,
        'created_by'           => $this->user->id,
        'business_resource_id' => $resource->id,
        'scheduled_at'         => $scheduledAt,
        'estimated_end'        => $estimatedEnd,
        'status'               => 'pending',
    ]);

    // Client tries to book the same resource in the same slot
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id'   => $this->clientResource->id,
            'service_id'           => $this->service->id,
            'scheduled_at'         => $scheduledAt->toIso8601String(),
            'business_resource_id' => $resource->id,
        ]);

    $response->assertStatus(409);
    $response->assertJsonPath('error.code', 'NO_RESOURCE_AVAILABLE');
});
