<?php
// apps/backend/tests/Feature/ServiceLog/EditPaymentMethodTest.php
//
// Corregir el método de pago desde el editor cambiaba el registro y dejaba el
// cobro como estaba. Pasó en producción el 24 de agosto: Vanessa cobró $55 en
// efectivo a las 12:21 y Fernanda lo corrigió a transferencia por Pichincha a
// las 16:08. El log quedó en `transfer`, la fila de `payments` en `cash`.
//
// Desde ahí las pantallas se separan: Reportes lee el registro, el Registro
// Diario y la Caja leen el cobro. Y el esperado del cajón siguió contando esos
// $55 como billetes, así que el arqueo de esa caja cerró con un faltante de
// $50 que en realidad era un pago mal clasificado.

use App\Application\Services\CashRegister;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
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

    $this->owner = UserModel::factory()->create(['name' => 'Federman']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 55]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->session = fn (string $status) => CashSessionModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'business_date' => now()->toDateString(), 'opened_by' => $this->owner->id,
        'opened_at' => now(), 'opening_amount' => 40, 'status' => $status,
    ]);

    // El ticket del 24: $55 cobrados en efectivo, dentro de una caja.
    $this->cobrado = function (?CashSessionModel $session, array $tramos = [['cash', 55]]) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => 55,
            'payment_status' => 'paid',
            'payment_method' => $tramos[0][0],
            'status' => 'in_progress',
        ]);

        $pagos = [];
        foreach ($tramos as [$metodo, $monto]) {
            $pago = PaymentModel::create([
                'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
                'amount' => $monto, 'method' => $metodo, 'paid_at' => now(),
                'received_by' => $this->owner->id,
                'cash_session_id' => $session?->id,
            ]);
            PaymentAllocationModel::create([
                'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
                'payment_id' => $pago->id, 'payable_type' => 'service_log',
                'payable_id' => $log->id, 'amount' => $monto,
            ]);
            $pagos[] = $pago;
        }

        return [$log, $pagos];
    };

    $this->as = fn () => $this->actingAs($this->owner)->withHeader('X-Tenant', $this->tenant->slug);
});

test('correcting the method on the log corrects the payment too', function () {
    [$log, $pagos] = ($this->cobrado)(($this->session)('open'));

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}", [
            'payment_method' => 'transfer',
            'payment_bank'   => 'pichincha',
        ])
        ->assertOk();

    expect($pagos[0]->fresh()->method)->toBe('transfer');
    expect($pagos[0]->fresh()->bank)->toBe('pichincha');
});

test('the till stops expecting cash that turned out to be a transfer', function () {
    // Es la razón de ser del arreglo. Sin esto el cajón espera $55 que nunca
    // estuvieron y el cajero cierra con un faltante que no cometió.
    $caja = ($this->session)('open');
    [$log] = ($this->cobrado)($caja);

    expect(app(CashRegister::class)->expectedFor($caja))->toBe(95.0);

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}", ['payment_method' => 'transfer'])
        ->assertOk();

    expect(app(CashRegister::class)->expectedFor($caja))->toBe(40.0);
});

test('a payment already counted in a closed till cannot change method', function () {
    // El dueño comparó ese número contra billetes. Cambiarle el método al
    // cobro ahora reescribe lo que el cajón debía tener a esa hora.
    [$log, $pagos] = ($this->cobrado)(($this->session)('closed'));

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}", ['payment_method' => 'transfer'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_METHOD_LOCKED');

    expect($pagos[0]->fresh()->method)->toBe('cash');
    expect($log->fresh()->payment_method)->toBe('cash');
});

test('a ticket paid with two methods cannot be corrected from the log', function () {
    // $60 en efectivo y $14 en transferencia: "el método" del registro no
    // significa nada ahí, y elegir uno borraría el otro.
    [$log, $pagos] = ($this->cobrado)(null, [['cash', 41], ['transfer', 14]]);

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}", ['payment_method' => 'transfer'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_METHOD_SPLIT');

    expect($pagos[0]->fresh()->method)->toBe('cash');
    expect($pagos[1]->fresh()->method)->toBe('transfer');
});

test('a ticket with nothing collected can still set its method freely', function () {
    // Sin cobro no hay nada que contradecir: el método del registro es una
    // intención, no un hecho.
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 55,
        'payment_status' => 'unpaid',
        'payment_method' => null,
        'status' => 'in_progress',
    ]);

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}", ['payment_method' => 'transfer'])
        ->assertOk();

    expect($log->fresh()->payment_method)->toBe('transfer');
});

test('the correction is still written to the log history', function () {
    [$log] = ($this->cobrado)(($this->session)('open'));

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}", ['payment_method' => 'transfer'])
        ->assertOk();

    $eventos = ($this->as)()->getJson("/api/v1/service-logs/{$log->id}")->json('data.events');
    $cambio = collect($eventos)->firstWhere('event', 'log_updated');

    expect($cambio)->not->toBeNull();
    expect(collect($cambio['detail']['changes'])->pluck('field'))->toContain('payment_method');
});
