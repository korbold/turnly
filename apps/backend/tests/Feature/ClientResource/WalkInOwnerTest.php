<?php
// apps/backend/tests/Feature/ClientResource/WalkInOwnerTest.php
//
// De quién queda el vehículo cuando lo registra el mostrador.
//
// Había una asimetría de una línea: registrando como admin, la persona se
// creaba sola; registrando como cajero, el auto quedaba colgado del usuario
// de la CAJERA. Y por el mostrador entra todo el trabajo real, así que en
// producción 237 de 274 vehículos figuran como de Vanessa — y la pantalla de
// Clientes, que esconde a propósito lo del personal, mostraba 37.
//
// Un auto sin dueño conocido queda sin dueño. Nunca del empleado.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->crear = fn (UserModel $u, array $body) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', array_merge(['type' => 'sedan'], $body));
});

test('a cashier registering a walk-in never becomes the owner', function () {
    $cajera = ($this->member)('cashier');

    ($this->crear)($cajera, ['data' => ['plate' => 'IBE3469']])->assertStatus(201);

    $recurso = ClientResourceModel::withoutGlobalScopes()->first();
    expect($recurso->client_id)->not->toBe($cajera->id);
    // Sin nombre no hay persona: el auto queda sin dueño, que es honesto.
    expect($recurso->client_id)->toBeNull();
});

test('the typed name becomes the client', function () {
    $cajera = ($this->member)('cashier');

    ($this->crear)($cajera, ['data' => ['plate' => 'IBE3469', 'nombre' => 'Gaby Arellano']])
        ->assertStatus(201);

    $recurso = ClientResourceModel::withoutGlobalScopes()->first();
    expect($recurso->client_id)->not->toBeNull();
    expect($recurso->client->name)->toBe('Gaby Arellano');
    expect($recurso->client_id)->not->toBe($cajera->id);
});

test('the same name twice reuses the person', function () {
    // Es lo que hace posible sumar la deuda de sus dos autos.
    $cajera = ($this->member)('cashier');

    ($this->crear)($cajera, ['data' => ['plate' => 'IBE3469', 'nombre' => 'Gaby Arellano']]);
    ($this->crear)($cajera, ['data' => ['plate' => 'PCC7286', 'nombre' => 'Gaby Arellano']]);

    $duenos = ClientResourceModel::withoutGlobalScopes()->pluck('client_id')->unique();
    expect($duenos)->toHaveCount(1);
    expect($duenos->first())->not->toBeNull();
});

test('an explicit client_id wins over the typed name', function () {
    // Es el caso del buscador: el cajero tocó una persona de la lista.
    $cajera  = ($this->member)('cashier');
    $persona = ($this->member)('client');

    ($this->crear)($cajera, [
        'client_id' => $persona->id,
        'data' => ['plate' => 'IBE3469', 'nombre' => 'como se escriba'],
    ])->assertStatus(201);

    expect(ClientResourceModel::withoutGlobalScopes()->first()->client_id)->toBe($persona->id);
});

test('a washer registering does not become the owner either', function () {
    $lavador = ($this->member)('washer');

    ($this->crear)($lavador, ['data' => ['plate' => 'IBE3469']])->assertStatus(201);

    expect(ClientResourceModel::withoutGlobalScopes()->first()->client_id)->toBeNull();
});

test('a customer registering their own vehicle still owns it', function () {
    // Desde la app del cliente sí es su auto: la regla es "el empleado no se
    // queda con el vehículo", no "nadie queda con el vehículo".
    $cliente = ($this->member)('client');

    ($this->crear)($cliente, ['data' => ['plate' => 'IBE3469']])->assertStatus(201);

    expect(ClientResourceModel::withoutGlobalScopes()->first()->client_id)->toBe($cliente->id);
});

test('the owner registering does not become the owner of the car', function () {
    // Ya funcionaba así, y no puede romperse: es la mitad que estaba bien.
    $dueno = ($this->member)('owner');

    ($this->crear)($dueno, ['data' => ['plate' => 'IBE3469']])->assertStatus(201);

    expect(ClientResourceModel::withoutGlobalScopes()->first()->client_id)->toBeNull();
});
