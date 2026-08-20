<?php
// apps/backend/tests/Feature/Pricing/DiscountAtCounterTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
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

    $this->owner   = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');

    // $15 de catálogo: el ejemplo exacto del dueño.
    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 15.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (UserModel $u, float $price, array $extra = []) => ($this->as)($u)
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $u->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => $price,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('a cashier lowering the price without a reason is refused', function () {
    // El caso del dueño: cobra $15, registra $12, se queda $3.
    ($this->register)($this->cashier, 12.00)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');

    expect(ServiceLogModel::withoutGlobalScopes()->count())->toBe(0);
});

test('a cashier lowering the price with a reason goes through', function () {
    // Los clientes especiales existen. Bloquear traba el mostrador.
    $res = ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'cliente_frecuente',
    ])->assertStatus(201);

    $log = ServiceLogModel::withoutGlobalScopes()->find($res->json('data.id'));
    expect((float) $log->price_charged)->toBe(12.0);
    expect($log->price_change_reason)->toBe('cliente_frecuente');

    // La foto del catálogo, sin la cual el reporte no puede calcular nada.
    $item = ServiceLogItemModel::withoutGlobalScopes()->where('service_log_id', $log->id)->first();
    expect((float) $item->catalog_price)->toBe(15.0);
    expect((float) $item->unit_price)->toBe(12.0);
});

test('registering at the catalog price needs no reason', function () {
    // El caso normal no puede pedir nada: es el 95% de los registros.
    ($this->register)($this->cashier, 15.00)->assertStatus(201);
});

test('the owner may discount without justifying', function () {
    // El privilegio Precio pasa a significar "puede hacerlo sin motivo".
    $res = ($this->register)($this->owner, 12.00)->assertStatus(201);

    $log = ServiceLogModel::withoutGlobalScopes()->find($res->json('data.id'));
    expect($log->price_change_reason)->toBeNull();
    // Pero la foto se guarda igual: el reporte tiene que contarlo.
    $item = ServiceLogItemModel::withoutGlobalScopes()->where('service_log_id', $log->id)->first();
    expect((float) $item->catalog_price)->toBe(15.0);
});

test('an unknown reason code is refused', function () {
    ($this->register)($this->cashier, 12.00, ['price_change_reason' => 'cliente_especial'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_INVALID');
});

test('otro without a note is refused', function () {
    // Sin nota, "Otro" es texto libre disfrazado de categoría.
    ($this->register)($this->cashier, 12.00, ['price_change_reason' => 'otro'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_INVALID');

    ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'otro',
        'price_change_note'   => 'amigo del dueño',
    ])->assertStatus(201);
});

test('charging ABOVE catalog also needs a reason', function () {
    // Una sola regla, sin casos especiales. Un recargo sin explicar tampoco
    // debería existir.
    ($this->register)($this->cashier, 18.00)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');
});

test('the trail records catalog, charged and reason', function () {
    $id = ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'promocion',
    ])->json('data.id');

    $evento = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', 'price_changed')
        ->first();

    expect($evento)->not->toBeNull();
    expect((float) $evento->detail['catalog'])->toBe(15.0);
    expect((float) $evento->detail['charged'])->toBe(12.0);
    expect($evento->detail['reason'])->toBe('promocion');
});

test('editing the quantity does not re-photograph the catalog', function () {
    // Se vendió a catálogo hoy; el catálogo sube el mes que viene; el cajero
    // entra sólo a corregir la cantidad. Si el borrar-y-reinsertar le saca una
    // foto nueva, el reporte inventa un descuento de $3 a nombre de alguien.
    $id = ($this->register)($this->cashier, 15.00)->json('data.id');

    $this->service->update(['price' => 18.00]);

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 2, 'unit_price' => 15.00,
            ]],
        ])
        ->assertStatus(200);

    $item = ServiceLogItemModel::withoutGlobalScopes()->where('service_log_id', $id)->first();
    expect((float) $item->catalog_price)->toBe(15.0);
    expect((float) $item->qty)->toBe(2.0);
});

test('a line added during an edit snapshots the catalog of today', function () {
    // La otra mitad de la regla: arrastrar la foto vale para lo que ya estaba,
    // no para lo que recién entra.
    $id = ($this->register)($this->cashier, 15.00)->json('data.id');

    $otro = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 7.50,
    ]);

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [
                ['service_id' => $this->service->id, 'label' => 'Lavado', 'qty' => 1, 'unit_price' => 15.00],
                ['service_id' => $otro->id, 'label' => 'Pulido', 'qty' => 1, 'unit_price' => 7.50],
            ],
        ])
        ->assertStatus(200);

    $nuevo = ServiceLogItemModel::withoutGlobalScopes()
        ->where('service_log_id', $id)->where('ref_id', $otro->id)->first();
    expect((float) $nuevo->catalog_price)->toBe(7.5);
});

test('an edit that declares no reason keeps the one already on the ticket', function () {
    // El cajero descontó y dijo por qué; el dueño entra después a corregir la
    // cantidad y no manda motivo porque no le hace falta. Pisar el campo con
    // null deja el descuento sin dueño y el reporte lo lee como "Sin motivo".
    $id = ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'cliente_frecuente',
    ])->json('data.id');

    ($this->as)($this->owner)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 11.00,
            ]],
        ])
        ->assertStatus(200);

    $log = ServiceLogModel::withoutGlobalScopes()->find($id);
    expect($log->price_change_reason)->toBe('cliente_frecuente');
});

test('editing the items down later also needs a reason', function () {
    $id = ($this->register)($this->cashier, 15.00)->json('data.id');

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');
});
