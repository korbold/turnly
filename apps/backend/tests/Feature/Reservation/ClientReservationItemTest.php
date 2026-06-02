<?php

use App\Domain\Reservation\Enums\ReservationStatus;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->client = UserModel::factory()->create();
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->client->id,
        'role'      => 'client',
        'is_active' => true,
    ]);

    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->client->id,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->variantA = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $this->service->id,
        'label' => 'Mediano',
        'price' => 15,
        'duration_min' => 30,
    ]);
    $this->variantB = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $this->service->id,
        'label' => 'Grande',
        'price' => 25,
        'duration_min' => 45,
    ]);

    $this->reservation = ReservationModel::create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->client->id,
        'client_resource_id' => $resource->id,
        'service_id' => $this->service->id,
        'service_variant_id' => $this->variantA->id,
        'scheduled_at' => now()->addHours(3),
        'estimated_end' => now()->addHours(3)->addMinutes(30),
        'status' => 'confirmed',
        'created_by' => $this->client->id,
    ]);

    ReservationItemModel::create([
        'tenant_id' => $this->tenant->id,
        'reservation_id' => $this->reservation->id,
        'item_type' => 'service_variant',
        'ref_id' => $this->variantA->id,
        'label' => 'Lavada Mediano',
        'qty' => 1,
        'unit_price' => 15,
        'line_total' => 15,
    ]);
});

test('client can list items of their own reservation', function () {
    $response = $this->actingAs($this->client)
        ->getJson("/api/v1/client/reservations/{$this->reservation->id}/items");

    $response->assertOk()->assertJsonCount(1, 'data');
});

test('client can add a service item to a confirmed reservation', function () {
    $response = $this->actingAs($this->client)
        ->postJson("/api/v1/client/reservations/{$this->reservation->id}/items", [
            'item_type' => 'service_variant',
            'ref_id'    => $this->variantB->id,
            'qty'       => 1,
        ]);

    $response->assertCreated();
    expect(ReservationItemModel::where('reservation_id', $this->reservation->id)->count())->toBe(2);
});

test('client cannot edit a reservation that is already checked_in', function () {
    $this->reservation->update(['status' => ReservationStatus::CheckedIn->value]);

    $response = $this->actingAs($this->client)
        ->postJson("/api/v1/client/reservations/{$this->reservation->id}/items", [
            'item_type' => 'service_variant',
            'ref_id'    => $this->variantB->id,
        ]);

    $response->assertStatus(422);
});

test('client cannot edit a reservation belonging to another user', function () {
    $other = UserModel::factory()->create();

    $response = $this->actingAs($other)
        ->postJson("/api/v1/client/reservations/{$this->reservation->id}/items", [
            'item_type' => 'service_variant',
            'ref_id'    => $this->variantB->id,
        ]);

    $response->assertStatus(404);
});

test('client cannot edit when within the cooldown window of the scheduled start', function () {
    $this->reservation->update(['scheduled_at' => now()->addMinutes(10)]);

    $response = $this->actingAs($this->client)
        ->postJson("/api/v1/client/reservations/{$this->reservation->id}/items", [
            'item_type' => 'service_variant',
            'ref_id'    => $this->variantB->id,
        ]);

    $response->assertStatus(422);
});

test('client cannot remove the only remaining service line', function () {
    $itemId = $this->reservation->items()->first()->id;

    $response = $this->actingAs($this->client)
        ->deleteJson("/api/v1/client/reservation-items/{$itemId}");

    $response->assertStatus(422);
    $response->assertJsonPath('error.code', 'LAST_SERVICE');
});

test('client can remove an extra line after adding another', function () {
    // Add a second service line so the first is no longer the last.
    ReservationItemModel::create([
        'tenant_id' => $this->tenant->id,
        'reservation_id' => $this->reservation->id,
        'item_type' => 'service_variant',
        'ref_id' => $this->variantB->id,
        'label' => 'Lavada Grande',
        'qty' => 1,
        'unit_price' => 25,
        'line_total' => 25,
    ]);

    $first = $this->reservation->items()->first();

    $response = $this->actingAs($this->client)
        ->deleteJson("/api/v1/client/reservation-items/{$first->id}");

    $response->assertOk();
    expect(ReservationItemModel::where('reservation_id', $this->reservation->id)->count())->toBe(1);
});
