<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;

/**
 * Las rutas de client-resources sirven a la vez al cliente (sus vehículos,
 * sin negocio) y al mostrador (con X-Tenant). Hacían `findOrFail($id)` sin
 * mirar de quién era el vehículo: con el id —que `lookup` regalaba a partir
 * de la placa— cualquier usuario leía la cédula y la dirección del dueño o se
 * quedaba con el auto. Y `clients/search` listaba a los usuarios de toda la
 * plataforma con tres letras.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'slug' => 'lavadora']);
    $this->cashier = rsMember($this->tenant, 'cashier');

    $this->owner = rsMember($this->tenant, 'client');
    UserBillingProfileModel::create([
        'user_id' => $this->owner->id, 'doc_type' => 'cedula', 'doc_number' => '1712345678',
        'legal_name' => 'Dueña Real', 'email' => 'duena@real.ec', 'address' => 'Calle Secreta 123', 'is_default' => true,
    ]);
    $this->car = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'data' => ['placa' => 'IBA1234'],
    ]);

    // Un usuario cualquiera de la plataforma, cliente de otro negocio.
    $other = TenantModel::factory()->create(['status' => 'active', 'slug' => 'otro']);
    $this->stranger = rsMember($other, 'client');
});

function rsMember(TenantModel $tenant, string $role): UserModel
{
    $user = UserModel::factory()->create(['email_verified_at' => now()]);
    TenantUserModel::create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => $role, 'is_active' => true]);

    return $user;
}

// --- A1: el vehículo es del dueño y del mostrador de su negocio ---------------

test('a stranger cannot read, edit or take a vehicle by its id', function (string $method, string $suffix, array $body) {
    $this->actingAs($this->stranger, 'sanctum')
        ->json($method, "/api/v1/client-resources/{$this->car->id}{$suffix}", $body)
        ->assertNotFound();
})->with([
    'show'           => ['GET', '', []],
    'history'        => ['GET', '/history', []],
    'billing'        => ['GET', '/billing', []],
    'debt'           => ['GET', '/debt', []],
    'update billing' => ['PUT', '/billing', ['doc_type' => 'final_consumer']],
    'update'         => ['PATCH', '', ['data' => ['placa' => 'IBA1234']]],
    'destroy'        => ['DELETE', '', []],
]);

test('a stranger cannot steal the vehicle by pointing client_id at itself', function () {
    $this->actingAs($this->stranger, 'sanctum')
        ->patchJson("/api/v1/client-resources/{$this->car->id}", ['client_id' => $this->stranger->id]);

    expect($this->car->fresh()->client_id)->toBe($this->owner->id);
});

test('the plate lookup is for the counter, not for anyone with a login', function () {
    $this->actingAs($this->stranger, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/client-resources/lookup?plate=IBA1234')
        ->assertForbidden();

    $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/client-resources/lookup?plate=IBA1234')
        ->assertOk()->assertJsonPath('data.id', $this->car->id);
});

test('the whole list of the business is for the counter only', function () {
    $this->actingAs($this->stranger, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/client-resources?all=1')
        ->assertForbidden();

    $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/client-resources?all=1')
        ->assertOk();
});

test('a customer cannot create a vehicle in someone else name nor touch their fiscal data', function () {
    $this->actingAs($this->stranger, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->postJson('/api/v1/client-resources', [
            'client_id' => $this->owner->id,
            'data' => ['placa' => 'PBX9999'],
            'billing_profile' => ['doc_type' => 'cedula', 'doc_number' => '1712345678', 'legal_name' => 'Pisado', 'address' => 'Otra'],
        ]);

    $profile = UserBillingProfileModel::where('user_id', $this->owner->id)->where('is_default', true)->first();
    expect($profile->legal_name)->toBe('Dueña Real');
    expect(ClientResourceModel::where('client_id', $this->owner->id)->count())->toBe(1);
});

test('a duplicate plate does not tell a customer whose car it is', function () {
    $res = $this->actingAs($this->stranger, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->postJson('/api/v1/client-resources', ['data' => ['placa' => 'IBA1234']]);

    $res->assertStatus(422)->assertJsonPath('error.code', 'DUPLICATE_PLATE');
    expect($res->json('error.existing'))->toBeNull();
});

test('the owner keeps full use of their vehicle', function () {
    // Con el negocio en la cabecera, como la manda la app (tenant_interceptor).
    $as = fn () => $this->actingAs($this->owner, 'sanctum')->withHeader('X-Tenant', 'lavadora');

    $as()->getJson("/api/v1/client-resources/{$this->car->id}")->assertOk();
    $as()->getJson("/api/v1/client-resources/{$this->car->id}/history")->assertOk();
    $as()->patchJson("/api/v1/client-resources/{$this->car->id}", ['data' => ['placa' => 'IBA1234', 'color' => 'rojo']])
        ->assertOk();
});

test('the counter of the business keeps working the vehicle', function () {
    $as = fn () => $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora');

    $as()->getJson("/api/v1/client-resources/{$this->car->id}")->assertOk();
    $as()->getJson("/api/v1/client-resources/{$this->car->id}/billing")
        ->assertOk()->assertJsonPath('data.doc_number', '1712345678');
    $as()->getJson("/api/v1/client-resources/{$this->car->id}/debt")->assertOk();
});

// --- A2: la búsqueda no lista la plataforma -----------------------------------

test('client search does not list people from other businesses by a fragment', function () {
    $this->stranger->update(['name' => 'Ximena Ajena', 'email' => 'ximena@ajena.ec']);

    $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/clients/search?q=Ximena')
        ->assertOk()->assertJsonCount(0, 'data');

    $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/clients/search?q=ajena')
        ->assertOk()->assertJsonCount(0, 'data');
});

test('client search still finds someone from elsewhere by the full email, phone or id number', function () {
    $this->stranger->update(['email' => 'ximena@ajena.ec', 'phone' => '0991112233']);
    UserBillingProfileModel::create([
        'user_id' => $this->stranger->id, 'doc_type' => 'cedula', 'doc_number' => '1002003004',
        'legal_name' => 'Ximena', 'email' => 'ximena@ajena.ec', 'is_default' => true,
    ]);

    foreach (['ximena@ajena.ec', '0991112233', '1002003004'] as $q) {
        $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora')
            ->getJson('/api/v1/clients/search?q='.urlencode($q))
            ->assertOk()
            ->assertJsonPath('data.0.id', $this->stranger->id)
            ->assertJsonPath('data.0.tenant_relation', 'not_linked');
    }
});

test('client search still finds the business own clients by a fragment', function () {
    $this->owner->update(['name' => 'Dueña Real']);

    $this->actingAs($this->cashier, 'sanctum')->withHeader('X-Tenant', 'lavadora')
        ->getJson('/api/v1/clients/search?q=Dueña')
        ->assertOk()->assertJsonPath('data.0.id', $this->owner->id);
});
