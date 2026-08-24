<?php
// apps/backend/tests/Feature/ClientResource/ReleaseStaffOwnedTest.php
//
// Fase 2 del diseño de identidad: soltar los vehículos que quedaron colgados
// del personal.
//
// El alta ya no los cuelga (fase 1), pero lo viejo sigue mal: en producción
// 237 de 274 vehículos figuran como de la cajera, y como la lista de Clientes
// esconde a propósito lo que cuelga del personal, la pantalla muestra 37.
// Ese `client_id` no es un dato: es ruido que además esconde el padrón.

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

    $this->recurso = fn (?string $clientId, string $plate) => ClientResourceModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'client_id' => $clientId,
        'type' => 'sedan',
        'data' => ['plate' => $plate],
    ]);
});

test('a vehicle hanging off the cashier is released', function () {
    $cajera = ($this->member)('cashier');
    $auto = ($this->recurso)($cajera->id, 'IBE3469');

    $this->artisan('clients:release-staff-owned', ['--tenant' => $this->tenant->slug])
        ->assertSuccessful();

    expect($auto->fresh()->client_id)->toBeNull();
});

test('every staff role is released, not just the cashier', function () {
    $autos = collect(['owner', 'tenant_admin', 'cashier', 'washer'])
        ->map(fn ($rol, $i) => ($this->recurso)(($this->member)($rol)->id, "PLA000{$i}"));

    $this->artisan('clients:release-staff-owned', ['--tenant' => $this->tenant->slug]);

    expect($autos->every(fn ($a) => $a->fresh()->client_id === null))->toBeTrue();
});

test('a vehicle that belongs to a real client is left alone', function () {
    // Es el punto: soltar lo que está mal sin tocar lo que está bien.
    $cliente = ($this->member)('client');
    $auto = ($this->recurso)($cliente->id, 'GAB1111');

    $this->artisan('clients:release-staff-owned', ['--tenant' => $this->tenant->slug]);

    expect($auto->fresh()->client_id)->toBe($cliente->id);
});

test('an already unowned vehicle is not touched', function () {
    $auto = ($this->recurso)(null, 'SIN0001');

    $this->artisan('clients:release-staff-owned', ['--tenant' => $this->tenant->slug]);

    expect($auto->fresh()->client_id)->toBeNull();
});

test('the history stays put', function () {
    // Soltar el dueño no puede mover un servicio ni un peso: el vehículo es
    // el mismo, sólo deja de decir que es del empleado.
    $cajera = ($this->member)('cashier');
    $auto = ($this->recurso)($cajera->id, 'IBE3469');
    $servicio = \App\Infrastructure\Persistence\Models\ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $auto->id,
        'attended_by' => $cajera->id,
        'created_by' => $cajera->id,
        'price_charged' => 15,
        'log_date' => now()->toDateString(),
    ]);

    $this->artisan('clients:release-staff-owned', ['--tenant' => $this->tenant->slug]);

    expect($servicio->fresh()->client_resource_id)->toBe($auto->id);
    expect((float) $servicio->fresh()->price_charged)->toBe(15.0);
});

test('the dry run changes nothing', function () {
    $cajera = ($this->member)('cashier');
    $auto = ($this->recurso)($cajera->id, 'IBE3469');

    $this->artisan('clients:release-staff-owned', [
        '--tenant' => $this->tenant->slug,
        '--dry-run' => true,
    ])->assertSuccessful();

    expect($auto->fresh()->client_id)->toBe($cajera->id);
});

test('another tenant is not touched', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    $suCajera = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $suCajera->id, 'role' => 'cashier', 'is_active' => true,
    ]);
    $suAuto = ClientResourceModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'client_id' => $suCajera->id, 'type' => 'sedan', 'data' => ['plate' => 'ZZZ9999'],
    ]);

    $this->artisan('clients:release-staff-owned', ['--tenant' => $this->tenant->slug]);

    expect($suAuto->fresh()->client_id)->toBe($suCajera->id);
});
