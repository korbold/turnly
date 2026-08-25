<?php
// apps/backend/tests/Feature/Cash/CashRequiredForCashTest.php
//
// Cobrar en efectivo exige caja abierta.
//
// El 24 de agosto se cobraron $45 en efectivo veintiún minutos después de
// cerrar la caja: ese billete quedó en el cajón sin que ningún arqueo lo
// esperara. Los POS de la región exigen turno abierto para cobrar, y ésta es
// la misma regla.
//
// Va detrás de un ajuste del tenant porque hay negocios que nunca abren caja:
// para ellos la regla sería un candado sobre todos sus cobros en efectivo.

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'settings' => ['require_open_till_for_cash' => true],
    ]);
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

    $this->owner   = ($this->member)('owner', 'Federman');
    $this->vanessa = ($this->member)('cashier', 'Vanessa');

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $service  = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->servicio = fn (float $precio = 45.00) => ServiceLogModel::factory()->create([
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

    $this->cobrar = fn (ServiceLogModel $log, string $metodo = 'cash') => ($this->as)($this->vanessa)
        ->postJson("/api/v1/service-logs/{$log->id}/payment", [
            'amount' => (float) $log->price_charged,
            'method' => $metodo,
        ]);

    $this->abrir = fn () => ($this->as)($this->vanessa)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => 40.00])
        ->json('data.id');
});

test('cash cannot be taken with the till closed', function () {
    $id = ($this->abrir)();
    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 40.00]);

    ($this->cobrar)(($this->servicio)())
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'CASH_REQUIRES_OPEN_TILL');
});

test('cash cannot be taken before the till is opened', function () {
    // Mismo caso por el otro lado: no hay caja todavía. Acá la salida es
    // abrirla, y eso el cajero sí puede hacerlo.
    ($this->cobrar)(($this->servicio)())
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'CASH_REQUIRES_OPEN_TILL');
});

test('with the till open the cash goes through', function () {
    ($this->abrir)();

    ($this->cobrar)(($this->servicio)())->assertSuccessful();
});

test('card and transfer never need a till', function () {
    // No tocan el cajón: pedirles caja abierta sería un candado sin motivo.
    ($this->cobrar)(($this->servicio)(), 'card')->assertSuccessful();
    ($this->cobrar)(($this->servicio)(), 'transfer')->assertSuccessful();
});

test('reopening the till lets the cash through again', function () {
    // La salida que el mensaje promete tiene que existir de verdad.
    $id = ($this->abrir)();
    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 40.00]);

    ($this->as)($this->owner)->postJson("/api/v1/cash-sessions/{$id}/reopen", [
        'reason' => 'Faltaba cobrar',
    ])->assertOk();

    ($this->cobrar)(($this->servicio)())->assertSuccessful();
});

test('a shop that does not use a till is not locked out', function () {
    // El ajuste apagado es el default: un negocio que nunca abre caja seguiría
    // cobrando en efectivo como siempre. Sin esto, encender esta regla dejaría
    // sin cobrar a todos los tenants que no usan la caja.
    $this->tenant->forceFill(['settings' => ['require_open_till_for_cash' => false]])->save();

    ($this->cobrar)(($this->servicio)())->assertSuccessful();
});

test('a tenant with no setting at all keeps working', function () {
    $this->tenant->forceFill(['settings' => []])->save();

    ($this->cobrar)(($this->servicio)())->assertSuccessful();
});

test('paying a debt in cash also needs the till', function () {
    // La regla es del dinero, no de la pantalla: si vale para el registro
    // diario, vale para la deuda.
    $log = ($this->servicio)(30.00);
    $log->forceFill(['left_owing' => true, 'status' => 'completed'])->save();

    ($this->as)($this->vanessa)
        ->postJson('/api/v1/debts/payments', [
            'client_resource_id' => $log->client_resource_id,
            'amount' => 30.00,
            'method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'CASH_REQUIRES_OPEN_TILL');
});
