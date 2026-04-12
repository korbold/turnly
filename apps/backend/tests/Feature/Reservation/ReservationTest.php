<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;

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

    // Create availability slots for all days of the week (00:00 - 23:59)
    // so reservation tests don't fail on business-hours checks
    for ($day = 0; $day <= 6; $day++) {
        AvailabilitySlotModel::create([
            'tenant_id' => $this->tenant->id,
            'day_of_week' => $day,
            'start_time' => '00:00:00',
            'end_time' => '23:59:00',
            'max_concurrent' => 10,
            'is_active' => true,
        ]);
    }
});

test('can create a reservation', function () {
    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id' => $this->service->id,
            'scheduled_at' => $scheduledAt->toIso8601String(),
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.status', 'pending');

    $this->assertDatabaseHas('reservations', [
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
    ]);
});

test('can list reservations', function () {
    ReservationModel::factory()->count(3)->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/reservations');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can show a reservation', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/{$reservation->id}");

    $response->assertOk()
        ->assertJsonPath('data.id', $reservation->id);
});

test('can confirm a reservation', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/reservations/{$reservation->id}/confirm");

    $response->assertOk();

    $this->assertDatabaseHas('reservations', [
        'id' => $reservation->id,
        'status' => 'confirmed',
    ]);
});

test('can start a wash from confirmed reservation', function () {
    $reservation = ReservationModel::factory()->confirmed()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/reservations/{$reservation->id}/start");

    $response->assertOk();

    $this->assertDatabaseHas('reservations', [
        'id' => $reservation->id,
        'status' => 'in_progress',
    ]);
});

test('can complete a reservation in progress', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
        'status' => 'in_progress',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/reservations/{$reservation->id}/complete");

    $response->assertOk();

    $this->assertDatabaseHas('reservations', [
        'id' => $reservation->id,
        'status' => 'completed',
    ]);
});

test('can cancel a reservation', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/reservations/{$reservation->id}/cancel", [
            'reason' => 'Client requested cancellation',
        ]);

    $response->assertOk();

    $this->assertDatabaseHas('reservations', [
        'id' => $reservation->id,
        'status' => 'cancelled',
    ]);
});

test('create reservation requires service_id and scheduled_at', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['service_id', 'scheduled_at']);
});

test('can filter reservations by status', function () {
    ReservationModel::factory()->count(2)->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
        'status' => 'pending',
    ]);
    ReservationModel::factory()->confirmed()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id' => $this->service->id,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/reservations?status=pending');

    $response->assertOk()
        ->assertJsonCount(2, 'data');
});
