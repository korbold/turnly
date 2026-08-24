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
    // La placa viaja dentro de `data` —son campos personalizados por tenant—
    // y no en la columna `plate`, que el repositorio nunca persiste. Este test
    // apuntaba a la columna y por eso pasó años en rojo mientras la misma
    // placa se cargaba cuatro veces en producción.
    ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'data' => ['plate' => 'PBA-1234'],
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'data' => ['plate' => 'PBA-1234'],
        ]);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'DUPLICATE_PLATE');
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

// ---------------------------------------------------------------------------
// Fiscal profile (GET/PUT client-resources/{id}/billing)
// ---------------------------------------------------------------------------

test('GET client-resources/{id}/billing falls back to consumidor final', function () {
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
    ]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/client-resources/{$resource->id}/billing")
        ->assertOk()
        ->assertJsonPath('data.doc_type', 'final_consumer');
});

test('PUT client-resources/{id}/billing creates then edits the default profile in place', function () {
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
    ]);

    // Create
    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/client-resources/{$resource->id}/billing", [
            'doc_type'   => 'cedula',
            'doc_number' => '1710034065',
            'legal_name' => 'Nombre Uno',
            'email'      => 'uno@example.com',
        ])
        ->assertOk()
        ->assertJsonPath('data.legal_name', 'Nombre Uno');

    // Edit in place — no duplicate row
    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/client-resources/{$resource->id}/billing", [
            'doc_type'   => 'cedula',
            'doc_number' => '1710034065',
            'legal_name' => 'Nombre Dos',
            'email'      => 'dos@example.com',
        ])
        ->assertOk();

    expect(\App\Infrastructure\Persistence\Models\UserBillingProfileModel::where('user_id', $this->user->id)->count())->toBe(1);
    $this->assertDatabaseHas('user_billing_profiles', [
        'user_id'    => $this->user->id,
        'legal_name' => 'Nombre Dos',
        'is_default' => true,
    ]);
});

test('PUT client-resources/{id}/billing rejects an invalid cedula', function () {
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
    ]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/client-resources/{$resource->id}/billing", [
            'doc_type'   => 'cedula',
            'doc_number' => '1234567890',
            'legal_name' => 'Bad',
            'email'      => 'x@example.com',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'INVALID_CEDULA');
});

test('client history returns typed service rows with serviceName + amount', function () {
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
    ]);
    $service = \App\Infrastructure\Persistence\Models\ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Lavada Premium',
    ]);
    \App\Infrastructure\Persistence\Models\ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id'         => $service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'status'             => 'completed',
        'payment_status'     => 'paid',
        'price_charged'      => 20.00,
        'started_at'         => now(),
    ]);

    $res = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/client-resources/{$resource->id}/history");

    $res->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.type', 'service')
        ->assertJsonPath('data.0.serviceName', 'Lavada Premium')
        ->assertJsonPath('data.0.amount', 20)
        ->assertJsonPath('data.0.paymentStatus', 'paid');
});
