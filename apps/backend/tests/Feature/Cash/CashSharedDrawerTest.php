<?php
// apps/backend/tests/Feature/Cash/CashSharedDrawerTest.php
//
// Un cajón, dos manos.
//
// En FEDER, Vanessa abre y cierra la caja y Fernanda —que recién entra— cobra
// el 85% del efectivo. Cuando el arqueo del 24 de agosto dio −$50, el sistema
// no tenía con qué separar una cosa de la otra: ni quién cobró cuánto, ni el
// hecho de que la caja cerró con 8 servicios sin cobrar por $305, veintiún
// minutos antes de que Fernanda cobrara $45 con el cajón ya cerrado.

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
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

    $this->member = function (string $role, string $name) {
        $user = UserModel::factory()->create(['name' => $name]);
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner    = ($this->member)('owner', 'Federman');
    $this->vanessa  = ($this->member)('cashier', 'Vanessa');
    $this->fernanda = ($this->member)('cashier', 'Fernanda');

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $service  = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    // Un servicio del día, cobrado o no.
    $this->servicio = function (float $precio) use ($service, $resource) {
        return ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $precio,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'log_date' => now()->toDateString(),
        ]);
    };

    $this->cobra = fn (UserModel $quien, float $monto, ?ServiceLogModel $log = null) => app(PaymentLedger::class)
        ->recordForServiceLog($log ?? ($this->servicio)($monto), $monto, 'cash', null, $quien->id);

    $this->abrir = fn (float $base = 40.00) => ($this->as)($this->vanessa)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => $base]);
});

// ---------------------------------------------------------------- pendientes

test('the till reports what is still uncollected, so closing early is a choice', function () {
    // El cierre de las 18:35 dejó afuera 8 servicios por $305. El cajero no
    // tenía cómo saberlo: con la caja abierta los totales del día se le
    // ocultan para el conteo ciego.
    ($this->abrir)();
    ($this->servicio)(200.00);
    ($this->servicio)(105.00);
    ($this->cobra)($this->fernanda, 50.00);

    $meta = ($this->as)($this->vanessa)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->json('meta');

    expect($meta['pending_collection']['count'])->toBe(2);
    expect((float) $meta['pending_collection']['amount'])->toBe(305.0);
});

test('what is pending does not leak what is in the drawer', function () {
    // Lo pendiente es plata que NO está en el cajón: mostrarlo no revela el
    // esperado, y por eso puede verse con la caja abierta.
    ($this->abrir)(40.00);
    ($this->cobra)($this->fernanda, 464.00);
    ($this->servicio)(305.00);

    $r = ($this->as)($this->vanessa)->getJson('/api/v1/cash-session')->assertOk();

    expect((float) $r->json('meta.pending_collection.amount'))->toBe(305.0);
    // El esperado sigue sin existir hasta el cierre.
    expect($r->json('data.expected_amount'))->toBeNull();
});

test('a service already paid is not pending', function () {
    ($this->abrir)();
    $log = ($this->servicio)(45.00);
    ($this->cobra)($this->fernanda, 45.00, $log);

    $meta = ($this->as)($this->vanessa)->getJson('/api/v1/cash-session')->json('meta');

    expect($meta['pending_collection']['count'])->toBe(0);
});

test('a partially paid service is pending only for what is left', function () {
    ($this->abrir)();
    $log = ($this->servicio)(74.00);
    ($this->cobra)($this->fernanda, 60.00, $log);

    $meta = ($this->as)($this->vanessa)->getJson('/api/v1/cash-session')->json('meta');

    expect($meta['pending_collection']['count'])->toBe(1);
    expect((float) $meta['pending_collection']['amount'])->toBe(14.0);
});

// ------------------------------------------------------------- por persona

test('closing reveals who collected how much cash', function () {
    // Con dos personas en un cajón, "faltan $50" no significa nada si no se
    // sabe que una tocó $434 y la otra $75.
    $abrir = ($this->abrir)(40.00);
    $id = $abrir->json('data.id');

    ($this->cobra)($this->fernanda, 434.00);
    ($this->cobra)($this->vanessa, 75.00);

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 549.00])
        ->assertOk();

    $porPersona = collect($r->json('data.cash_by_person'))->keyBy('name');

    expect((float) $porPersona['Fernanda']['amount'])->toBe(434.0);
    expect((float) $porPersona['Vanessa']['amount'])->toBe(75.0);
});

test('an open till does not say who collected what', function () {
    // Es el mismo dato que el conteo ciego oculta: sumarlo daría el esperado.
    $id = ($this->abrir)(40.00)->json('data.id');
    ($this->cobra)($this->fernanda, 100.00);

    $r = ($this->as)($this->vanessa)->getJson('/api/v1/cash-session')->assertOk();

    expect($r->json('data.cash_by_person'))->toBeNull();
});

test('card payments do not show up in the cash breakdown', function () {
    $id = ($this->abrir)(0.00)->json('data.id');
    $log = ($this->servicio)(20.00);
    app(PaymentLedger::class)->recordForServiceLog($log, 20.00, 'card', null, $this->fernanda->id);

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 0.00]);

    expect($r->json('data.cash_by_person'))->toBe([]);
});
