<?php
// apps/backend/tests/Feature/ServiceLog/VoidPaymentTest.php
//
// Anular el cobro de un registro. El caso que lo pidió: el cajero apretó
// "Cobrar ahora" por error y el ticket tenía que quedar por cobrar. Borrar el
// registro entero y volver a cargarlo pierde la hora, la bitácora y el
// vehículo; lo único que está mal es que la plata figure cobrada.
//
// Anula TODO lo cobrado del ticket, nunca una parte: si hubo dos abonos de $5,
// se van los dos y el registro vuelve a deber el total.

use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
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

    $this->owner   = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->session = fn (string $status) => CashSessionModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'business_date' => now()->toDateString(), 'opened_by' => $this->owner->id,
        'opened_at' => now(), 'opening_amount' => 40, 'status' => $status,
    ]);

    $this->log = fn (array $attrs = []) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 15,
        'payment_status' => 'paid',
        'status' => 'completed',
    ], $attrs));

    $this->cobro = function (ServiceLogModel $log, float $amount, ?CashSessionModel $session) {
        $pago = PaymentModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'amount' => $amount, 'method' => 'cash', 'paid_at' => now(),
            'received_by' => $this->owner->id, 'cash_session_id' => $session?->id,
        ]);
        PaymentAllocationModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'payment_id' => $pago->id, 'payable_type' => 'service_log',
            'payable_id' => $log->id, 'amount' => $amount,
        ]);
        return $pago;
    };

    $this->as = fn (UserModel $u) => $this->actingAs($u)->withHeader('X-Tenant', $this->tenant->slug);
});

test('the owner voids the charge and the ticket goes back to pending', function () {
    $log = ($this->log)();
    ($this->cobro)($log, 15, ($this->session)('open'));

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertOk();

    $log->refresh();
    expect($log->payment_status)->toBe('unpaid');
    expect($log->paid_at)->toBeNull();
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
    expect(PaymentAllocationModel::withoutGlobalScopes()->count())->toBe(0);
    // El servicio sigue siendo el mismo trabajo: hora, vehículo y estado.
    expect($log->status)->toBe('completed');
});

test('voiding clears every payment of the ticket, not just one', function () {
    // Lo que pidió el usuario con todas las letras: hoy se anuló $5 y los
    // otros $5 seguían sumando.
    $log = ($this->log)(['price_charged' => 10, 'payment_status' => 'paid']);
    $session = ($this->session)('open');
    ($this->cobro)($log, 5, $session);
    ($this->cobro)($log, 5, $session);

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertOk();

    expect($log->fresh()->payment_status)->toBe('unpaid');
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
});

test('the trail records who voided it and how much', function () {
    $log = ($this->log)();
    ($this->cobro)($log, 15, ($this->session)('open'));

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertOk();

    $evento = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', 'payment_voided')
        ->first();

    expect($evento)->not->toBeNull();
    expect((float) $evento->detail['amount'])->toBe(15.0);
    expect($evento->changed_by_user_id)->toBe($this->owner->id);
});

test('a cashier cannot void a charge', function () {
    // Quien cobra no se absuelve solo: es la misma regla del reporte de
    // descuentos y de corregir asignados después de completar.
    $log = ($this->log)();
    ($this->cobro)($log, 15, ($this->session)('open'));

    ($this->as)($this->cashier)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertStatus(403);

    expect($log->fresh()->payment_status)->toBe('paid');
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(1);
});

test('an invoiced ticket cannot be voided', function () {
    // Una factura autorizada se corrige con nota de crédito, nunca borrando
    // el cobro por atrás.
    $log = ($this->log)(['invoice_status' => 'AUTORIZADO']);
    ($this->cobro)($log, 15, ($this->session)('open'));

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_LOCKED');

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(1);
});

test('a charge that landed in a closed caja cannot be voided', function () {
    $log = ($this->log)();
    ($this->cobro)($log, 15, ($this->session)('closed'));

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_LOCKED');

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(1);
});

test('there is nothing to void on an unpaid ticket', function () {
    $log = ($this->log)(['payment_status' => 'unpaid']);

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'NOTHING_TO_VOID');
});

test('voiding does not put the sold products back on the shelf', function () {
    // Anular el cobro no cancela la venta: el ambientador está en el auto del
    // cliente, no en la estantería. Devolverlo al stock lo contaría dos veces.
    $log = ($this->log)();
    $product = ProductModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Ambientador', 'price' => 2.50, 'is_active' => true,
    ]);
    ServiceLogItemModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'service_log_id' => $log->id, 'item_type' => 'product',
        'ref_id' => $product->id, 'label' => 'Ambientador',
        'qty' => 1, 'unit_price' => 2.50, 'line_total' => 2.50, 'sort_order' => 0,
    ]);
    ($this->cobro)($log, 15, ($this->session)('open'));

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}/payment")
        ->assertOk();

    expect(
        \DB::table('stock_movements')->where('ref_id', $log->id)->count()
    )->toBe(0);
});
