<?php
// apps/backend/tests/Feature/Debt/ClientDebtTest.php
//
// La deuda de una persona, no de una placa.
//
// El caso que lo pidió: «Gaby debe $30 en un carro y $89 en el otro, y el
// cajero quiere buscar por nombre, ver los dos autos, la suma total, y cobrar
// o abonar la deuda». Todo el sistema de deuda estaba atado al vehículo.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
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

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->cajera = ($this->member)('cashier');
    $this->gaby   = ($this->member)('client');
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->auto = fn (string $plate, ?UserModel $dueno = null) => ClientResourceModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'client_id' => $dueno?->id,
        'type' => 'sedan',
        'data' => ['plate' => $plate],
    ]);

    // Un servicio que se fue debiendo: es lo que arma la deuda.
    $this->deuda = fn (ClientResourceModel $auto, float $monto, string $fecha) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $auto->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->cajera->id,
        'created_by' => $this->cajera->id,
        'price_charged' => $monto,
        'payment_status' => 'unpaid',
        'left_owing' => true,
        'status' => 'completed',
        'log_date' => $fecha,
    ]);

    $this->as = fn (UserModel $u) => $this->actingAs($u)->withHeader('X-Tenant', $this->tenant->slug);
});

test('the person owes what both of their vehicles owe', function () {
    $uno = ($this->auto)('GAB1111', $this->gaby);
    $dos = ($this->auto)('GAB2222', $this->gaby);
    ($this->deuda)($uno, 30, '2026-08-10');
    ($this->deuda)($dos, 89, '2026-08-20');

    $r = ($this->as)($this->cajera)
        ->getJson("/api/v1/clients/{$this->gaby->id}/debt")
        ->assertOk();

    expect((float) $r->json('data.total'))->toBe(119.0);
    expect($r->json('data.items'))->toHaveCount(2);
    // Cada deuda dice de qué auto es: sin eso el cajero no sabe qué le está
    // cobrando al cliente que tiene enfrente.
    expect($r->json('data.items.0.resource_label'))->toContain('GAB1111');
});

test('the debts come oldest first', function () {
    $uno = ($this->auto)('GAB1111', $this->gaby);
    $dos = ($this->auto)('GAB2222', $this->gaby);
    ($this->deuda)($dos, 89, '2026-08-20');
    ($this->deuda)($uno, 30, '2026-08-10');

    $items = ($this->as)($this->cajera)
        ->getJson("/api/v1/clients/{$this->gaby->id}/debt")
        ->json('data.items');

    expect($items[0]['date'])->toBe('2026-08-10');
});

test('a payment is split across the vehicles, oldest first', function () {
    // $50 sobre $119: cancela los $30 del auto viejo y abona $20 al otro.
    $uno = ($this->auto)('GAB1111', $this->gaby);
    $dos = ($this->auto)('GAB2222', $this->gaby);
    $viejo = ($this->deuda)($uno, 30, '2026-08-10');
    $nuevo = ($this->deuda)($dos, 89, '2026-08-20');

    ($this->as)($this->cajera)
        ->postJson("/api/v1/clients/{$this->gaby->id}/debt/payment", [
            'amount' => 50, 'method' => 'cash',
        ])
        ->assertOk();

    expect($viejo->fresh()->payment_status)->toBe('paid');
    expect($nuevo->fresh()->payment_status)->toBe('partial');

    // Un solo pago con dos asignaciones, no dos pagos.
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(1);
    expect((float) PaymentModel::withoutGlobalScopes()->first()->amount)->toBe(50.0);
});

test('paying everything leaves the person at zero', function () {
    $uno = ($this->auto)('GAB1111', $this->gaby);
    $dos = ($this->auto)('GAB2222', $this->gaby);
    ($this->deuda)($uno, 30, '2026-08-10');
    ($this->deuda)($dos, 89, '2026-08-20');

    ($this->as)($this->cajera)
        ->postJson("/api/v1/clients/{$this->gaby->id}/debt/payment", [
            'amount' => 119, 'method' => 'cash',
        ])
        ->assertOk();

    $r = ($this->as)($this->cajera)->getJson("/api/v1/clients/{$this->gaby->id}/debt");
    expect((float) $r->json('data.total'))->toBe(0.0);
});

test('the plan can be read before charging', function () {
    // El reparto automático toca varios autos con un solo pago: se muestra
    // antes de confirmar o es un automatismo que nadie puede auditar.
    $uno = ($this->auto)('GAB1111', $this->gaby);
    $dos = ($this->auto)('GAB2222', $this->gaby);
    ($this->deuda)($uno, 30, '2026-08-10');
    ($this->deuda)($dos, 89, '2026-08-20');

    $plan = ($this->as)($this->cajera)
        ->getJson("/api/v1/clients/{$this->gaby->id}/debt?amount=50")
        ->json('data.plan');

    expect($plan)->toHaveCount(2);
    expect((float) $plan[0]['amount'])->toBe(30.0);
    expect((float) $plan[1]['amount'])->toBe(20.0);
});

test('another person\'s debt is not counted', function () {
    $otro = ($this->member)('client');
    $suyo = ($this->auto)('OTR1111', $otro);
    ($this->deuda)($suyo, 500, '2026-08-01');

    $mio = ($this->auto)('GAB1111', $this->gaby);
    ($this->deuda)($mio, 30, '2026-08-10');

    $r = ($this->as)($this->cajera)->getJson("/api/v1/clients/{$this->gaby->id}/debt");

    expect((float) $r->json('data.total'))->toBe(30.0);
});

test('a vehicle with no owner is nobody\'s debt', function () {
    // Los 277 sueltos no pueden aparecer bajo una persona por accidente.
    $suelto = ($this->auto)('SIN0001', null);
    ($this->deuda)($suelto, 40, '2026-08-10');

    $r = ($this->as)($this->cajera)->getJson("/api/v1/clients/{$this->gaby->id}/debt");

    expect((float) $r->json('data.total'))->toBe(0.0);
});

test('paying more than owed is refused', function () {
    $uno = ($this->auto)('GAB1111', $this->gaby);
    ($this->deuda)($uno, 30, '2026-08-10');

    ($this->as)($this->cajera)
        ->postJson("/api/v1/clients/{$this->gaby->id}/debt/payment", [
            'amount' => 100, 'method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'AMOUNT_TOO_HIGH');
});
