<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 30.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (array $extra = []) => ($this->as)()
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 30.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('registering with a partial amount leaves the service partial', function () {
    // La escena: deja el auto y paga $10 de $30.
    $res = ($this->register)(['amount_received' => 10.00])->assertStatus(201);

    expect($res->json('data.payment_status'))->toBe('partial');
    expect((float) $res->json('data.amount_paid'))->toBe(10.0);
    expect((float) $res->json('data.amount_due'))->toBe(20.0);
    expect((float) PaymentModel::withoutGlobalScopes()->sum('amount'))->toBe(10.0);
});

test('registering without an amount still charges the whole thing', function () {
    // Nadie que no conozca el campo nuevo cambia de comportamiento.
    $res = ($this->register)()->assertStatus(201);

    expect($res->json('data.payment_status'))->toBe('paid');
    expect((float) $res->json('data.amount_due'))->toBe(0.0);
});

test('collecting the rest closes the service', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $res = ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash', 'amount' => 20.00])
        ->assertOk();

    expect($res->json('data.payment_status'))->toBe('paid');
    expect((float) $res->json('data.amount_due'))->toBe(0.0);
    expect((float) PaymentModel::withoutGlobalScopes()->sum('amount'))->toBe(30.0);
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(2);
});

test('collecting without an amount pays off whatever is left', function () {
    // El diálogo viejo, y la app móvil, mandan sólo el método.
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash'])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid');

    expect((float) PaymentModel::withoutGlobalScopes()->sum('amount'))->toBe(30.0);
});

test('a second partial keeps it partial', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $res = ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash', 'amount' => 5.00])
        ->assertOk();

    expect($res->json('data.payment_status'))->toBe('partial');
    expect((float) $res->json('data.amount_paid'))->toBe(15.0);
    expect((float) $res->json('data.amount_due'))->toBe(15.0);
});

test('a paid service is still refused a second collection', function () {
    // El guard de ALREADY_PAID no se toca: cobrarle dos veces al mismo
    // servicio completo sigue siendo un error, no un abono.
    $id = ($this->register)()->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash', 'amount' => 5.00])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_PAID');
});

test('the trail records what was paid and what is left', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $evento = \App\Infrastructure\Persistence\Models\ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', 'payment_recorded')
        ->first();

    expect((float) $evento->detail['amount'])->toBe(10.0);
    expect((float) $evento->detail['remaining'])->toBe(20.0);
});

test('an unpaid service reports the whole price as due', function () {
    $res = ($this->register)(['payment_status' => 'unpaid'])->assertStatus(201);

    expect($res->json('data.payment_status'))->toBe('unpaid');
    expect((float) $res->json('data.amount_paid'))->toBe(0.0);
    expect((float) $res->json('data.amount_due'))->toBe(30.0);
});
