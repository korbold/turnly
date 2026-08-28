<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

/**
 * El 28 de agosto se encontró por qué 32 servicios de FEDER decían "Sin
 * recurso": este comando corre cada hora y borra en duro a todo usuario sin
 * `email_verified_at`. Los clientes del mostrador se crean así —con un correo
 * inventado `@client.local` y sin verificar— y `client_resources.client_id`
 * es ON DELETE CASCADE, de modo que el vehículo se iba con la persona y el
 * servicio quedaba huérfano sin evento ni `updated_at` que lo delatara.
 *
 * El comando existe para limpiar registros abandonados, no para borrar
 * clientes reales. Estos tests fijan las dos mitades: sigue limpiando lo que
 * nunca fue nadie, y no toca a quien ya tiene historia.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
});

function makeUnverified(string $email, ?string $createdAt = '-3 days'): UserModel
{
    $user = UserModel::factory()->create([
        'email' => $email,
        'email_verified_at' => null,
    ]);

    // `created_at` es el que decide, y factory lo pone en now().
    $user->forceFill(['created_at' => now()->parse($createdAt)])->save();

    return $user;
}

function asClientOf(UserModel $user, TenantModel $tenant): UserModel
{
    TenantUserModel::create([
        'tenant_id' => $tenant->id,
        'user_id'   => $user->id,
        'role'      => 'client',
        'is_active' => true,
    ]);

    return $user;
}

test('purges an abandoned self-registration', function () {
    $abandoned = makeUnverified('nadie@gmail.com');

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($abandoned->id))->toBeNull();
});

test('keeps a user who verified, however old', function () {
    $real = UserModel::factory()->create(['email_verified_at' => now()->subYear()]);
    $real->forceFill(['created_at' => now()->subYear()])->save();

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($real->id))->not->toBeNull();
});

test('keeps a user younger than the cutoff', function () {
    $fresh = makeUnverified('recien@gmail.com', '-2 hours');

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($fresh->id))->not->toBeNull();
});

// El correo `@client.local` no es un correo: es el relleno que
// `findOrCreateClient()` inventa para el walk-in que dio su nombre en el
// mostrador. Nunca va a verificarse, así que la regla de las 24h lo condena
// desde que nace.
test('never purges a counter-created walk-in client', function () {
    $walkin = asClientOf(makeUnverified('don-eduardo-EtJQ@client.local'), $this->tenant);

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($walkin->id))->not->toBeNull();
});

// El vehículo es la puerta por la que se perdían los servicios: borrar al
// dueño lo borraba a él, y el servicio quedaba sin auto.
test('never purges a user who owns a client resource', function () {
    $owner = asClientOf(makeUnverified('con-auto@gmail.com'), $this->tenant);

    ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $owner->id,
        'data'      => ['placa' => 'PDB2264'],
    ]);

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($owner->id))->not->toBeNull();
});

// `reservations.client_id` también es CASCADE: la reserva se borraba entera.
test('never purges a user with reservations', function () {
    $client = asClientOf(makeUnverified('con-reserva@gmail.com'), $this->tenant);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    // La reserva cuelga de un vehículo que NO es del cliente: sin esto el
    // test pasaría por la puerta del recurso y no por la de la reserva.
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => null,
        'data'      => ['placa' => 'IAI3869'],
    ]);

    ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $client->id,
        'client_resource_id' => $resource->id,
        'service_id'         => $service->id,
        'created_by'         => $client->id,
        'scheduled_at'       => now()->subDay(),
    ]);

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($client->id))->not->toBeNull();
});

// El registro abandonado que sí creó un negocio sigue llevándose su tenant:
// esa es la limpieza que el comando existe para hacer.
test('still drops the tenant left behind by an abandoned signup', function () {
    $tenant = TenantModel::factory()->create(['status' => 'pending']);
    $owner  = makeUnverified('abandonado@gmail.com');

    TenantUserModel::create([
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    $this->artisan('users:purge-unverified')->assertSuccessful();

    expect(UserModel::find($owner->id))->toBeNull()
        ->and(TenantModel::find($tenant->id))->toBeNull();
});
