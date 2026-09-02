<?php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

/*
 * El Registro Diario cuenta la plata por `paid_at` —un ticket de ayer cobrado
 * hoy suma en "Ingresos del día"— pero listaba las filas por `log_date`. El
 * dueño veía el dinero y no al cliente que lo trajo, y la tabla no cuadraba
 * con su propio titular. La lista de un día incluye lo cobrado ese día.
 */

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service  = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = fn (string $fecha, float $precio) => ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id'         => $service->id,
        'attended_by'        => $this->owner->id,
        'created_by'         => $this->owner->id,
        'price_charged'      => $precio,
        'payment_status'     => 'unpaid',
        'paid_at'            => null,
        'payment_method'     => null,
        'log_date'           => $fecha,
        'started_at'         => $fecha . ' 09:00:00',
    ]);

    $this->listar = fn (array $q = []) => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/service-logs?' . http_build_query($q));
});

test('el ticket de ayer cobrado hoy aparece en la lista de hoy', function () {
    $ayer = ($this->log)(now()->subDay()->toDateString(), 20.00);
    $hoy  = ($this->log)(now()->toDateString(), 10.00);

    app(PaymentLedger::class)->recordForServiceLog($ayer, 20.00, 'cash', null, $this->owner->id);

    $ids = collect(($this->listar)(['date' => now()->toDateString()])->assertOk()->json('data'))
        ->pluck('id')->all();

    expect($ids)->toContain($ayer->id);
    expect($ids)->toContain($hoy->id);
});

test('el ticket de ayer sin cobrar no se cuela en hoy', function () {
    $ayer = ($this->log)(now()->subDay()->toDateString(), 20.00);
    $hoy  = ($this->log)(now()->toDateString(), 10.00);

    $ids = collect(($this->listar)(['date' => now()->toDateString()])->assertOk()->json('data'))
        ->pluck('id')->all();

    expect($ids)->toBe([$hoy->id]);
});

test('el cobro viejo se ordena por la hora del cobro, no por la del registro', function () {
    // El de ayer se registró a las 09:00 y se cobró recién ahora; el de hoy
    // entró a las 08:00. Por `started_at` el viejo caería al fondo, lejos del
    // movimiento de caja que lo puso en esta pantalla.
    $ayer = ($this->log)(now()->subDay()->toDateString(), 20.00);
    $hoy  = ($this->log)(now()->toDateString(), 10.00);
    $hoy->update(['started_at' => now()->toDateString() . ' 08:00:00']);

    app(PaymentLedger::class)->recordForServiceLog($ayer, 20.00, 'cash', null, $this->owner->id);

    $ids = collect(($this->listar)(['date' => now()->toDateString()])->assertOk()->json('data'))
        ->pluck('id')->all();

    expect($ids)->toBe([$ayer->id, $hoy->id]);
});

test('el ticket de ayer sigue apareciendo en su propio día', function () {
    $ayer = ($this->log)(now()->subDay()->toDateString(), 20.00);

    app(PaymentLedger::class)->recordForServiceLog($ayer, 20.00, 'cash', null, $this->owner->id);

    $ids = collect(($this->listar)(['date' => now()->subDay()->toDateString()])->assertOk()->json('data'))
        ->pluck('id')->all();

    expect($ids)->toBe([$ayer->id]);
});

test('las filas de hoy conservan su orden por hora aunque se cobren tarde', function () {
    // El de las 08:00 se cobra al mediodía y el de las 11:00 sigue pendiente.
    // Ordenar TODO por el cobro treparía el de las 08:00 y dejaría la columna
    // HORA leyéndose al revés.
    $temprano = ($this->log)(now()->toDateString(), 25.00);
    $temprano->update(['started_at' => now()->toDateString() . ' 08:00:00']);
    $tarde = ($this->log)(now()->toDateString(), 12.00);
    $tarde->update(['started_at' => now()->toDateString() . ' 11:00:00']);

    app(PaymentLedger::class)->recordForServiceLog($temprano->fresh(), 25.00, 'cash', null, $this->owner->id);

    $ids = collect(($this->listar)(['date' => now()->toDateString()])->assertOk()->json('data'))
        ->pluck('id')->all();

    expect($ids)->toBe([$tarde->id, $temprano->id]);
});
