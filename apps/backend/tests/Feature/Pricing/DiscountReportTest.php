<?php
// apps/backend/tests/Feature/Pricing/DiscountReportTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    if (config('database.default') === 'sqlite') {
        $this->markTestSkipped('Los reportes se prueban contra MySQL: en SQLite log_date conserva la hora y whereBetween no encuentra nada.');
    }

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create(['name' => 'Dueño']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);
    $this->cajero = UserModel::factory()->create(['name' => 'Cajero']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cajero->id, 'role' => 'cashier', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->hoy = now()->toDateString();

    $this->venta = function (float $catalogo, float $cobrado, ?string $motivo, UserModel $quien)
        use ($service, $resource) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $quien->id,
            'created_by' => $quien->id,
            'price_charged' => $cobrado,
            'price_change_reason' => $motivo,
            'log_date' => now()->toDateString(),
        ]);
        ServiceLogItemModel::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'service_log_id' => $log->id,
            'item_type' => 'service_variant',
            'ref_id' => $service->id,
            'label' => 'Lavado',
            'qty' => 1,
            'unit_price' => $cobrado,
            'catalog_price' => $catalogo,
            'line_total' => $cobrado,
        ]);
        return $log;
    };

    $this->reporte = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/discounts?date_from={$this->hoy}&date_to={$this->hoy}");
});

test('a sale at catalog price is not a discount', function () {
    ($this->venta)(15.00, 15.00, null, $this->cajero);

    ($this->reporte)()->assertOk()
        ->assertJsonPath('data.total_given_away', 0)
        ->assertJsonCount(0, 'data.items');
});

test('a row with no catalog snapshot is old, not a discount', function () {
    // Las filas históricas no tienen catalog_price. Contarlas inventaría
    // descuentos que nunca existieron.
    $log = ($this->venta)(15.00, 12.00, 'promocion', $this->cajero);
    ServiceLogItemModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)->update(['catalog_price' => null]);

    ($this->reporte)()->assertOk()->assertJsonCount(0, 'data.items');
});

test('the headline is what was given away', function () {
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);   // −3
    ($this->venta)(15.00, 10.00, 'promocion', $this->cajero);           // −5

    ($this->reporte)()->assertOk()
        ->assertJsonPath('data.total_given_away', 8)
        ->assertJsonCount(2, 'data.items');
});

test('a surcharge does not offset a discount', function () {
    // Mezclarlos daría un neto que esconde los dos.
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);   // −3
    ($this->venta)(15.00, 18.00, 'acordado', $this->cajero);            // +3

    ($this->reporte)()->assertOk()
        ->assertJsonPath('data.total_given_away', 3)
        ->assertJsonCount(2, 'data.items');
});

test('it groups by reason', function () {
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);
    ($this->venta)(15.00, 13.00, 'cliente_frecuente', $this->cajero);
    ($this->venta)(15.00, 10.00, 'promocion', $this->cajero);

    $res = ($this->reporte)()->assertOk();
    $porMotivo = collect($res->json('data.by_reason'))->keyBy('code');

    expect((float) $porMotivo['cliente_frecuente']['total'])->toBe(5.0);
    expect($porMotivo['cliente_frecuente']['count'])->toBe(2);
    expect($porMotivo['cliente_frecuente']['label'])->toBe('Cliente frecuente');
    expect((float) $porMotivo['promocion']['total'])->toBe(5.0);
});

test('it groups by who did it', function () {
    // La comparación entre personas es lo que delata.
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);
    ($this->venta)(15.00, 14.00, null, $this->owner);

    $porUsuario = collect(($this->reporte)()->json('data.by_user'))->keyBy('name');

    expect((float) $porUsuario['Cajero']['total'])->toBe(3.0);
    expect((float) $porUsuario['Dueño']['total'])->toBe(1.0);
});

test('the owners discount shows with no reason, not hidden', function () {
    // Un reporte que sólo cuenta los descuentos ajenos no sirve para decidir
    // precios.
    ($this->venta)(15.00, 12.00, null, $this->owner);

    $item = ($this->reporte)()->json('data.items.0');
    expect($item['reason_code'])->toBeNull();
    expect((float) $item['difference'])->toBe(-3.0);
});

test('a cashier cannot read the discount report', function () {
    // Visible para quien los hace, no controla nada.
    $this->actingAs($this->cajero)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/discounts?date_from={$this->hoy}&date_to={$this->hoy}")
        ->assertStatus(403);
});

test('a blank service-log reason and a codeless legacy reservation override are not the same bucket', function () {
    // El primero es un dueño que no tuvo que justificarse; el segundo es una
    // fila de antes de que el código existiera. Confundirlos en "__none__"
    // haría que el bucket mostrara "Sin motivo" u "Otro" según quién entrara
    // primero en la lista — no determinista, y falso en los dos sentidos.
    ($this->venta)(15.00, 12.00, null, $this->owner);   // -3, sin motivo

    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->owner->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'created_by' => $this->cajero->id,
        'scheduled_at' => now(),
    ]);
    ReservationItemChangeModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'reservation_id' => $reservation->id,
        'action' => ReservationItemChangeModel::ACTION_PRICE_OVERRIDE,
        'item_type' => 'service_variant',
        'label' => 'Lavado',
        'old_price' => 15.00,
        'new_price' => 12.00,
        'reason' => null,
        'reason_code' => null,
        'changed_by_user_id' => $this->cajero->id,
        'changed_at' => now(),
    ]);

    $porMotivo = collect(($this->reporte)()->json('data.by_reason'))->keyBy('label');

    expect($porMotivo)->toHaveCount(2);
    expect((float) $porMotivo['Sin motivo']['total'])->toBe(3.0);
    expect((float) $porMotivo['Otro']['total'])->toBe(3.0);
});
