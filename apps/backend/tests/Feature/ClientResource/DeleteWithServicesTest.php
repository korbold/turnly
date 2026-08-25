<?php
// apps/backend/tests/Feature/ClientResource/DeleteWithServicesTest.php
//
// Borrar un vehículo se llevaba el vínculo de sus servicios sin avisar. La FK
// de `service_logs.client_resource_id` es ON DELETE SET NULL, así que el
// registro sobrevive con su precio, su cobro y su bitácora, y pierde el auto
// al que se le hizo el trabajo. En producción quedaron 11 servicios cobrados
// así, uno por día entre el 2 y el 25 de agosto: no se puede saber sobre qué
// vehículo se trabajó, y el cliente los pierde de su historial y de su total
// gastado.
//
// El candado ya existía para las reservas y no para los servicios: protegía
// la agenda y dejaba pasar la plata.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->vehiculo = fn () => ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->owner->id,
        'type'      => 'sedan',
    ]);

    $this->servicioSobre = fn (ClientResourceModel $r) => ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $r->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->owner->id,
        'created_by'         => $this->owner->id,
        'price_charged'      => 6,
        'log_date'           => now()->toDateString(),
    ]);

    $this->as = fn () => $this->actingAs($this->owner)->withHeader('X-Tenant', $this->tenant->slug);
});

test('a vehicle with services registered on it cannot be deleted', function () {
    $vehiculo = ($this->vehiculo)();
    $log = ($this->servicioSobre)($vehiculo);

    ($this->as)()
        ->deleteJson("/api/v1/client-resources/{$vehiculo->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'HAS_SERVICES');

    // Lo que importa: el servicio conserva su vehículo.
    expect($log->fresh()->client_resource_id)->toBe($vehiculo->id);
    expect(ClientResourceModel::withoutGlobalScopes()->find($vehiculo->id))->not->toBeNull();
});

test('the refusal says how many services are in the way', function () {
    // "No se puede" sin decir cuántos deja al mostrador sin saber si es un
    // ticket de prueba o el historial de un año.
    $vehiculo = ($this->vehiculo)();
    ($this->servicioSobre)($vehiculo);
    ($this->servicioSobre)($vehiculo);

    ($this->as)()
        ->deleteJson("/api/v1/client-resources/{$vehiculo->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.services', 2);
});

test('a vehicle with nothing on it is still deleted', function () {
    $vehiculo = ($this->vehiculo)();

    ($this->as)()
        ->deleteJson("/api/v1/client-resources/{$vehiculo->id}")
        ->assertOk();

    expect(ClientResourceModel::find($vehiculo->id))->toBeNull();
});

test('reservations keep blocking the delete, as before', function () {
    $vehiculo = ($this->vehiculo)();
    ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $vehiculo->id,
        'service_id'         => $this->service->id,
        'client_id'          => $this->owner->id,
        'created_by'         => $this->owner->id,
    ]);

    ($this->as)()
        ->deleteJson("/api/v1/client-resources/{$vehiculo->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'HAS_RESERVATIONS');
});

test('a cancelled service still blocks the delete', function () {
    // Un registro anulado sigue siendo historia del vehículo: se muestra en
    // el día y en el historial de la placa. Perderle el auto lo vuelve
    // ilegible igual que a uno cobrado.
    $vehiculo = ($this->vehiculo)();
    $log = ($this->servicioSobre)($vehiculo);
    $log->forceFill(['cancelled_at' => now(), 'cancel_reason_code' => 'error'])->save();

    ($this->as)()
        ->deleteJson("/api/v1/client-resources/{$vehiculo->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'HAS_SERVICES');
});

test('the refusal points at the way out', function () {
    // El mensaje lo lee el dueño del auto en el móvil, no un empleado: un "no
    // se puede" sin salida es lo que hace que insista o llame al local.
    $vehiculo = ($this->vehiculo)();
    ($this->servicioSobre)($vehiculo);

    $r = ($this->as)()->deleteJson("/api/v1/client-resources/{$vehiculo->id}")->assertStatus(422);

    expect($r->json('error.can_release'))->toBeTrue();
});

test('a client can take a vehicle with history out of their list', function () {
    // La salida: el auto sale de MI lista y el trabajo que el local hizo sobre
    // él queda intacto. Es lo que se necesita cuando alguien vende el auto.
    $vehiculo = ($this->vehiculo)();
    $log = ($this->servicioSobre)($vehiculo);

    ($this->as)()
        ->postJson("/api/v1/client-resources/{$vehiculo->id}/release")
        ->assertOk();

    $fresco = ClientResourceModel::withoutGlobalScopes()->find($vehiculo->id);

    expect($fresco)->not->toBeNull();          // el vehículo sigue existiendo
    expect($fresco->client_id)->toBeNull();     // pero ya no es de nadie
    expect($log->fresh()->client_resource_id)->toBe($vehiculo->id); // el servicio conserva su auto
});

test('releasing someone elses vehicle is a 404', function () {
    // El id de otro cliente no se confirma ni se niega.
    $ajeno = UserModel::factory()->create();
    $vehiculo = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $ajeno->id,
        'type'      => 'sedan',
    ]);

    ($this->as)()
        ->postJson("/api/v1/client-resources/{$vehiculo->id}/release")
        ->assertStatus(404);

    expect(ClientResourceModel::withoutGlobalScopes()->find($vehiculo->id)->client_id)
        ->toBe($ajeno->id);
});

test('a vehicle with no history is deleted, not released', function () {
    // Sin historial no hace falta conservarlo: borrar sigue siendo borrar.
    $vehiculo = ($this->vehiculo)();

    ($this->as)()->deleteJson("/api/v1/client-resources/{$vehiculo->id}")->assertOk();

    expect(ClientResourceModel::find($vehiculo->id))->toBeNull();
});
