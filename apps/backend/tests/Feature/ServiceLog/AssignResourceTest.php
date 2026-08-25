<?php
// apps/backend/tests/Feature/ServiceLog/AssignResourceTest.php
//
// Un servicio que perdió su vehículo no tenía forma de recuperarlo. En
// producción quedaron 11 así —cobrados, con bitácora, sin auto— y la pantalla
// de detalle no ofrecía nada: el dueño sabía de quién era ese lavado y no
// tenía dónde decirlo.
//
// Sólo se puede asignar cuando está vacío. Cambiar el vehículo de un servicio
// que ya lo tiene es otra cosa y el proyecto lo prohíbe a propósito: si el
// auto está mal, se corrige por el editor de ítems.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
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

    $this->miembro = function (string $role) {
        $u = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $u->id, 'role' => $role, 'is_active' => true,
        ]);
        return $u;
    };

    $this->owner   = ($this->miembro)('owner');
    $this->cajero  = ($this->miembro)('cashier');
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->vehiculo = fn (?string $placa = 'IBC4687') => ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->owner->id,
        'type'      => 'sedan',
        'data'      => ['plate' => $placa, 'brand' => 'Chevrolet', 'model' => 'Aveo'],
    ]);

    $this->huerfano = fn () => ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => null,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->owner->id,
        'created_by'         => $this->owner->id,
        'price_charged'      => 6,
        'payment_status'     => 'paid',
        'log_date'           => now()->toDateString(),
    ]);

    $this->as = fn (UserModel $u) => $this->actingAs($u)->withHeader('X-Tenant', $this->tenant->slug);
});

test('a service that lost its vehicle can get one back', function () {
    $log = ($this->huerfano)();
    $veh = ($this->vehiculo)();

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/resource", ['client_resource_id' => $veh->id])
        ->assertOk();

    expect($log->fresh()->client_resource_id)->toBe($veh->id);
});

test('the assignment is written to the log history with the plate', function () {
    // La bitácora es donde se lee quién tocó qué. Un uuid no dice nada, así
    // que el evento guarda la placa.
    $log = ($this->huerfano)();
    $veh = ($this->vehiculo)('PBT2759');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/resource", ['client_resource_id' => $veh->id]);

    $eventos = ($this->as)($this->owner)->getJson("/api/v1/service-logs/{$log->id}")->json('data.events');
    $evento  = collect($eventos)->firstWhere('event', 'resource_assigned');

    expect($evento)->not->toBeNull();
    expect($evento['detail']['plate'])->toBe('PBT2759');
    expect($evento['changed_by']['name'])->toBe($this->owner->name);
});

test('a service that already has a vehicle cannot be reassigned', function () {
    // El vehículo de un servicio registrado no se reescribe: si está mal, se
    // corrige por los ítems. Acá sólo se llena lo que está vacío.
    $veh   = ($this->vehiculo)();
    $otro  = ($this->vehiculo)('PDC5236');
    $log   = ($this->huerfano)();
    $log->forceFill(['client_resource_id' => $veh->id])->save();

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/resource", ['client_resource_id' => $otro->id])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'RESOURCE_ALREADY_SET');

    expect($log->fresh()->client_resource_id)->toBe($veh->id);
});

test('a vehicle from another tenant is not assignable', function () {
    $log = ($this->huerfano)();

    $otroTenant = TenantModel::factory()->create(['status' => 'active']);
    $ajeno = ClientResourceModel::factory()->create([
        'tenant_id' => $otroTenant->id,
        'client_id' => UserModel::factory()->create()->id,
        'type'      => 'sedan',
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/resource", ['client_resource_id' => $ajeno->id])
        ->assertStatus(404);

    expect($log->fresh()->client_resource_id)->toBeNull();
});

test('a cashier cannot assign the vehicle', function () {
    // Misma regla que corregir los asignados de un servicio completado: es
    // dato histórico, y lo arregla quien responde por el local.
    $log = ($this->huerfano)();
    $veh = ($this->vehiculo)();

    ($this->as)($this->cajero)
        ->patchJson("/api/v1/service-logs/{$log->id}/resource", ['client_resource_id' => $veh->id])
        ->assertStatus(403);

    expect($log->fresh()->client_resource_id)->toBeNull();
});
