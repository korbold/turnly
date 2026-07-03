<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('can create client resource', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'plate' => 'PBA-1234',
            'brand' => 'Toyota',
            'model' => 'Corolla',
            'color' => 'Blanco',
            'type' => 'sedan',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('plate', 'PBA-1234');

    $this->assertDatabaseHas('client_resources', [
        'plate' => 'PBA-1234',
        'tenant_id' => $this->tenant->id,
    ]);
});

test('can create client resource with minimal data', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'plate' => 'ABC-9999',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('plate', 'ABC-9999');
});

test('can create client resource without plate', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'brand' => 'Toyota',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('brand', 'Toyota');
});

test('can list client resources', function () {
    ClientResourceModel::factory()->count(3)->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

// Regression: the mobile booking screen opened then immediately closed because
// GET /client-resources sat behind the verified.email middleware while booking
// itself (/public/tenants/{slug}/book) is public. A customer whose email was
// not verified got a 403 EMAIL_NOT_VERIFIED, the app's interceptor bounced the
// whole nav stack to /login, and the screen vanished. The booking-flow reads
// must NOT require a verified email.
test('unverified customer can list client resources (booking flow not email-gated)', function () {
    $unverified = UserModel::factory()->create(['email_verified_at' => null]);

    ClientResourceModel::factory()->count(2)->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $unverified->id,
    ]);

    $response = $this->actingAs($unverified)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources');

    $response->assertOk()
        ->assertJsonCount(2, 'data');
});

test('can show client resource detail', function () {
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'plate' => 'XYZ-5678',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/client-resources/{$clientResource->id}");

    $response->assertOk()
        ->assertJsonPath('plate', 'XYZ-5678');
});

test('cannot create duplicate plate in same tenant', function () {
    ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'plate' => 'PBA-1234',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'plate' => 'PBA-1234',
        ]);

    $response->assertStatus(422);
});

test('can get client resource service history', function () {
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/client-resources/{$clientResource->id}/history");

    $response->assertOk()
        ->assertJsonStructure(['data']);
});
