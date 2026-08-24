<?php
// apps/backend/tests/Feature/ServiceLog/CancelServiceLogTest.php
//
// Anular reemplaza a eliminar. Eliminar era físico: la fila desaparecía y no
// quedaba ni quién ni cuándo, en la única pantalla del sistema que lleva caja.
// Anulado deja la fila visible y congelada, fuera de los totales.

use App\Domain\ServiceLog\CancelReason;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ProductModel;
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

    $this->log = fn (array $attrs = []) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 15,
        'payment_status' => 'unpaid',
        'status' => 'in_progress',
        'log_date' => now()->toDateString(),
    ], $attrs));

    $this->as = fn (UserModel $u) => $this->actingAs($u)->withHeader('X-Tenant', $this->tenant->slug);

    $this->anular = fn (UserModel $u, ServiceLogModel $log, array $body = []) => ($this->as)($u)
        ->postJson("/api/v1/service-logs/{$log->id}/cancel", array_merge([
            'reason_code' => CancelReason::DUPLICADO,
        ], $body));
});

test('the owner cancels a ticket and it stays as history', function () {
    $log = ($this->log)();

    ($this->anular)($this->owner, $log)->assertOk();

    $log->refresh();
    expect($log->status)->toBe('cancelled');
    expect($log->cancelled_at)->not->toBeNull();
    expect($log->cancelled_by)->toBe($this->owner->id);
    expect($log->cancel_reason_code)->toBe(CancelReason::DUPLICADO);
    // Lo que separa anular de eliminar: la fila sigue estando.
    expect(ServiceLogModel::withoutGlobalScopes()->find($log->id))->not->toBeNull();
});

test('a cancelled ticket leaves the day totals', function () {
    ($this->log)(['price_charged' => 15]);
    $anulado = ($this->log)(['price_charged' => 100]);

    ($this->anular)($this->owner, $anulado)->assertOk();

    $summary = ($this->as)($this->owner)
        ->getJson('/api/v1/service-logs/summary?date=' . now()->toDateString())
        ->json('data');

    // Los $100 anulados no pueden seguir contando como trabajo del día.
    expect((float) $summary['total_revenue'])->toBe(15.0);
    expect((int) $summary['total_washes'])->toBe(1);
});

test('a cancelled ticket still shows in the day list, marked', function () {
    // Sale de los totales pero no de la vista: la evidencia de que existió es
    // justamente el punto de anular en vez de borrar.
    $log = ($this->log)();
    ($this->anular)($this->owner, $log)->assertOk();

    $fila = collect(($this->as)($this->owner)
        ->getJson('/api/v1/service-logs?date=' . now()->toDateString())
        ->json('data'))
        ->firstWhere('id', $log->id);

    expect($fila)->not->toBeNull();
    expect($fila['status'])->toBe('cancelled');
    expect($fila['cancel_reason_label'])->toBe('Duplicado');
});

test('cancelling reverts the charge and frees the caja', function () {
    $session = CashSessionModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'business_date' => now()->toDateString(), 'opened_by' => $this->owner->id,
        'opened_at' => now(), 'opening_amount' => 40, 'status' => 'open',
    ]);

    $log = ($this->log)(['payment_status' => 'paid']);
    $pago = PaymentModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'amount' => 15, 'method' => 'cash', 'paid_at' => now(),
        'received_by' => $this->owner->id, 'cash_session_id' => $session->id,
    ]);
    PaymentAllocationModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'payment_id' => $pago->id, 'payable_type' => 'service_log',
        'payable_id' => $log->id, 'amount' => 15,
    ]);

    ($this->anular)($this->owner, $log)->assertOk();

    expect($log->fresh()->payment_status)->toBe('unpaid');
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
});

test('cancelling puts the sold products back on the shelf', function () {
    // Al revés que revertir el pago: acá la venta no existió, así que el
    // producto vuelve al estante.
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

    ($this->anular)($this->owner, $log)->assertOk();

    expect(\DB::table('stock_movements')->where('ref_id', $log->id)->count())->toBe(1);
});

test('a cancelled ticket is frozen', function () {
    $log = ($this->log)();
    ($this->anular)($this->owner, $log)->assertOk();

    // No se edita
    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['notes' => 'algo'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_CANCELLED');

    // No se completa
    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_CANCELLED');

    // No se cobra
    ($this->as)($this->owner)
        ->postJson("/api/v1/service-logs/{$log->id}/payment", ['method' => 'cash'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_CANCELLED');
});

test('the reason is a closed list and Otro needs a note', function () {
    $log = ($this->log)();

    ($this->anular)($this->owner, $log, ['reason_code' => 'porque_si'])
        ->assertStatus(422);

    ($this->anular)($this->owner, $log, ['reason_code' => CancelReason::OTRO])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_NOTE_REQUIRED');

    ($this->anular)($this->owner, $log, [
        'reason_code' => CancelReason::OTRO,
        'reason_note' => 'se registró en el tenant equivocado',
    ])->assertOk();

    expect($log->fresh()->cancel_reason_note)->toBe('se registró en el tenant equivocado');
});

test('a cashier cannot cancel', function () {
    $log = ($this->log)();

    ($this->anular)($this->cashier, $log)->assertStatus(403);

    expect($log->fresh()->status)->toBe('in_progress');
});

test('an invoiced ticket cannot be cancelled', function () {
    // Lo declarado al SRI se corrige con nota de crédito, no borrando la venta.
    $log = ($this->log)(['invoice_status' => 'AUTORIZADO']);

    ($this->anular)($this->owner, $log)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_LOCKED');
});

test('cancelling twice is refused', function () {
    $log = ($this->log)();
    ($this->anular)($this->owner, $log)->assertOk();

    ($this->anular)($this->owner, $log)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_CANCELLED');
});

test('the trail records the cancellation with its reason', function () {
    $log = ($this->log)();
    ($this->anular)($this->owner, $log, ['reason_code' => CancelReason::ARREPENTIDO])->assertOk();

    $evento = \App\Infrastructure\Persistence\Models\ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', 'log_cancelled')
        ->first();

    expect($evento)->not->toBeNull();
    expect($evento->detail['reason'])->toBe(CancelReason::ARREPENTIDO);
    expect($evento->changed_by_user_id)->toBe($this->owner->id);
});
