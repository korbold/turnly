<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->staff = UserModel::factory()->create();
    $this->client = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->client->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

function confirmedReservation($self): ReservationModel
{
    return ReservationModel::factory()->create([
        'tenant_id'          => $self->tenant->id,
        'client_id'          => $self->client->id,
        'client_resource_id' => $self->clientResource->id,
        'service_id'         => $self->service->id,
        'created_by'         => $self->staff->id,
        'status'             => 'confirmed',
    ]);
}

test('check-in persists inline billing as the client default profile', function () {
    $reservation = confirmedReservation($this);

    $this->actingAs($this->staff)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$reservation->id}/check-in", [
            'billing' => [
                'doc_type'   => 'cedula',
                'doc_number' => '0102030405',
                'legal_name' => 'Danny Barahona',
                'email'      => 'danny@example.com',
                'address'    => 'Av. Siempre Viva 742',
                'phone'      => '0999999999',
            ],
        ])
        ->assertOk();

    $this->assertDatabaseHas('user_billing_profiles', [
        'user_id'    => $this->client->id,
        'doc_type'   => 'cedula',
        'doc_number' => '0102030405',
        'legal_name' => 'Danny Barahona',
        'is_default' => true,
    ]);
});

test('a later check-in reuses the same profile row (updateOrCreate, not duplicate)', function () {
    $first = confirmedReservation($this);
    $this->actingAs($this->staff)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$first->id}/check-in", [
            'billing' => ['doc_type' => 'cedula', 'doc_number' => '0102030405', 'legal_name' => 'Danny B', 'email' => 'a@b.com'],
        ])->assertOk();

    $second = confirmedReservation($this);
    $this->actingAs($this->staff)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$second->id}/check-in", [
            'billing' => ['doc_type' => 'cedula', 'doc_number' => '0102030405', 'legal_name' => 'Danny Barahona', 'email' => 'a@b.com'],
        ])->assertOk();

    expect(UserBillingProfileModel::where('user_id', $this->client->id)->count())->toBe(1);
    expect(UserBillingProfileModel::where('user_id', $this->client->id)->first()->legal_name)->toBe('Danny Barahona');
});

test('check-in does NOT persist a consumidor final profile', function () {
    $reservation = confirmedReservation($this);

    $this->actingAs($this->staff)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$reservation->id}/check-in", [
            'billing' => ['doc_type' => 'final_consumer'],
        ])
        ->assertOk();

    $this->assertDatabaseMissing('user_billing_profiles', ['user_id' => $this->client->id]);
});

test('reservation resource exposes client default billing profile for prefill', function () {
    UserBillingProfileModel::create([
        'user_id'    => $this->client->id,
        'doc_type'   => 'cedula',
        'doc_number' => '0102030405',
        'legal_name' => 'Danny Barahona',
        'email'      => 'danny@example.com',
        'address'    => 'Av X',
        'phone'      => '0999999999',
        'is_default' => true,
    ]);

    $reservation = confirmedReservation($this);

    $this->actingAs($this->staff)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/{$reservation->id}")
        ->assertOk()
        ->assertJsonPath('data.client.default_billing_profile.doc_number', '0102030405')
        ->assertJsonPath('data.client.default_billing_profile.legal_name', 'Danny Barahona')
        ->assertJsonPath('data.client.default_billing_profile.address', 'Av X');
});
