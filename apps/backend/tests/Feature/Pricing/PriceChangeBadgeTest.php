<?php
// apps/backend/tests/Feature/Pricing/PriceChangeBadgeTest.php
//
// La lista del Registro Diario tiene que decir, sin abrir nada, qué fila
// llevó el precio cambiado y quién lo cambió. El reporte de descuentos ya
// muestra el desvío, pero atribuye la fila a su `attended_by`: si un admin
// edita el ticket del cajero, el reporte lo cuenta contra el cajero. La
// marca de la lista sale de la bitácora, que sí guarda al autor real.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
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

    $this->firstRow = fn (UserModel $u) => ($this->as)($u)
        ->getJson('/api/v1/service-logs?date=' . now()->toDateString())
        ->json('data.0');
});

test('the list marks the row with the deviation, its reason and who made it', function () {
    ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'otro',
        'price_change_note'   => 'amigo del dueño',
    ])->assertStatus(201);

    $row = ($this->firstRow)($this->owner);

    expect($row['price_change'])->not->toBeNull();
    expect($row['price_change']['catalog'])->toEqual(15.0);
    expect($row['price_change']['charged'])->toEqual(12.0);
    expect($row['price_change']['difference'])->toEqual(-3.0);
    expect($row['price_change']['reason_code'])->toBe('otro');
    expect($row['price_change']['reason_label'])->toBe('Otro');
    expect($row['price_change']['note'])->toBe('amigo del dueño');
    expect($row['price_change']['changes'])->toBe(1);
    expect($row['price_change']['by'])->toBe($this->cashier->name);
});

test('the row names whoever changed the price last, not whoever owns the ticket', function () {
    // El cajero registra su propio ticket y el dueño se lo corrige después.
    // El reporte de descuentos sigue contando la fila contra el cajero; la
    // marca de la lista tiene que decir el dueño.
    $create = ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'otro',
        'price_change_note'   => 'amigo del dueño',
    ])->assertStatus(201);

    $id = $create->json('data.id');

    ($this->as)($this->owner)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 11.00,
            ]],
            'price_change_reason' => 'cliente_frecuente',
        ])
        ->assertStatus(200);

    $row = ($this->firstRow)($this->owner);

    expect($row['price_change']['charged'])->toEqual(11.0);
    expect($row['price_change']['difference'])->toEqual(-4.0);
    expect($row['price_change']['reason_code'])->toBe('cliente_frecuente');
    expect($row['price_change']['changes'])->toBe(2);
    expect($row['price_change']['by'])->toBe($this->owner->name);
    expect($row['attended_by'])->toBe($this->cashier->id);
});

test('a surcharge is marked too, with the difference pointing up', function () {
    ($this->register)($this->cashier, 18.00, [
        'price_change_reason' => 'acordado',
    ])->assertStatus(201);

    $row = ($this->firstRow)($this->owner);

    expect($row['price_change']['difference'])->toEqual(3.0);
    expect($row['price_change']['reason_label'])->toBe('Precio acordado con el dueño');
});

test('a row charged at the catalog price carries no mark', function () {
    ($this->register)($this->cashier, 15.00)->assertStatus(201);

    expect(($this->firstRow)($this->owner)['price_change'])->toBeNull();
});

test('a legacy row with no catalog photo is not a discount', function () {
    // Una fila anterior a la feature: sin `catalog_price` no hay contra qué
    // comparar, y el reporte ya la ignora por la misma razón.
    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->cashier->id,
        'created_by'         => $this->cashier->id,
        'price_charged'      => 9.00,
        'log_date'           => now()->toDateString(),
    ]);
    ServiceLogItemModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'service_log_id' => $log->id, 'item_type' => 'service',
        'ref_id' => $this->service->id, 'label' => 'Lavado',
        'qty' => 1, 'unit_price' => 9.00, 'catalog_price' => null,
        'line_total' => 9.00, 'sort_order' => 0,
    ]);

    expect(($this->firstRow)($this->owner)['price_change'])->toBeNull();
});

test('the list does not drag the whole trail along with the mark', function () {
    // La marca sale de un evento, no de la bitácora entera: la lista del día
    // son 15 filas y `events` es N por fila.
    ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'promocion',
    ])->assertStatus(201);

    expect(($this->firstRow)($this->owner))->not->toHaveKey('events');
});
