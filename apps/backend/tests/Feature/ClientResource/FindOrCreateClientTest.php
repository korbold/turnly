<?php
// apps/backend/tests/Feature/ClientResource/FindOrCreateClientTest.php
//
// Cómo se decide que dos autos son de la misma persona.
//
// El emparejado era exacto (`where('name', $name)`), así que "Gaby Arellano"
// y "gaby arellano" eran dos personas y su deuda quedaba partida. En el
// mostrador el riesgo es bajo porque el buscador muestra a la persona y se la
// toca; el riesgo aparece al asignarle dueño a mano a los 277 vehículos que
// hoy dicen "Toca para asignar nombre".

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->cajera = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cajera->id, 'role' => 'cashier', 'is_active' => true,
    ]);

    $this->crear = fn (string $plate, string $nombre) => $this->actingAs($this->cajera)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'type' => 'sedan',
            'data' => ['plate' => $plate, 'nombre' => $nombre],
        ]);

    $this->duenos = fn () => ClientResourceModel::withoutGlobalScopes()
        ->pluck('client_id')->filter()->unique();
});

test('the same name in different case is the same person', function () {
    ($this->crear)('GAB1111', 'Gaby Arellano')->assertStatus(201);
    ($this->crear)('GAB2222', 'gaby arellano')->assertStatus(201);

    expect(($this->duenos)())->toHaveCount(1);
});

test('extra spaces do not split a person', function () {
    ($this->crear)('GAB1111', 'Gaby Arellano')->assertStatus(201);
    ($this->crear)('GAB2222', '  Gaby   Arellano ')->assertStatus(201);

    expect(($this->duenos)())->toHaveCount(1);
});

test('the person keeps the name as it was first written', function () {
    // Emparejar sin distinguir mayúsculas no significa reescribir el nombre:
    // el que quedó guardado es el que el mostrador ve en la lista.
    ($this->crear)('GAB1111', 'Gaby Arellano')->assertStatus(201);
    ($this->crear)('GAB2222', 'GABY ARELLANO')->assertStatus(201);

    $persona = UserModel::find(($this->duenos)()->first());
    expect($persona->name)->toBe('Gaby Arellano');
});

test('two different people are still two', function () {
    ($this->crear)('GAB1111', 'Gaby Arellano')->assertStatus(201);
    ($this->crear)('RUI3333', 'Gabriela Ruíz')->assertStatus(201);

    expect(($this->duenos)())->toHaveCount(2);
});

test('picking a person explicitly links the vehicle to them', function () {
    // El buscador manda: la persona es la que el usuario vio y tocó, sin
    // depender de que el texto coincida letra por letra.
    ($this->crear)('GAB1111', 'Gaby Arellano')->assertStatus(201);
    $gaby = ($this->duenos)()->first();

    $suelto = ClientResourceModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'client_id' => null, 'type' => 'sedan', 'data' => ['plate' => 'GAB2222'],
    ]);

    $this->actingAs($this->cajera)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/client-resources/{$suelto->id}", [
            'client_id' => $gaby,
            'data' => ['plate' => 'GAB2222', 'nombre' => 'como sea'],
        ])
        ->assertOk();

    expect($suelto->fresh()->client_id)->toBe($gaby);
    expect(($this->duenos)())->toHaveCount(1);
});

test('naming an unowned vehicle links it to the existing person', function () {
    // El camino de "Toca para asignar nombre": editar un vehículo suelto y
    // escribir el nombre de alguien que ya existe tiene que ligarlo, no
    // duplicarlo.
    ($this->crear)('GAB1111', 'Gaby Arellano')->assertStatus(201);

    $suelto = ClientResourceModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'client_id' => null, 'type' => 'sedan', 'data' => ['plate' => 'GAB2222'],
    ]);

    $this->actingAs($this->cajera)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/client-resources/{$suelto->id}", [
            'data' => ['plate' => 'GAB2222', 'nombre' => 'gaby  arellano'],
        ])
        ->assertOk();

    expect(($this->duenos)())->toHaveCount(1);
    expect($suelto->fresh()->client_id)->toBe(($this->duenos)()->first());
});
