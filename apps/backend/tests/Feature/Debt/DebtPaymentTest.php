<?php

use App\Application\Services\DebtLedger;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->debe = fn (float $price, string $date) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'left_owing' => true,
        'status' => 'completed',
        'log_date' => $date,
    ]);

    $this->manual = fn (float $amount, string $date) => ManualDebtModel::create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'client_id' => $this->user->id,
        'amount' => $amount, 'reason' => 'Cuaderno', 'incurred_on' => $date,
        'created_by' => $this->user->id,
    ]);

    $this->debts  = app(DebtLedger::class);
    $this->ledger = app(PaymentLedger::class);
});

test('one payment cancels the oldest debts first', function () {
    // El ejemplo del spec: debe $50 (15 del cuaderno + 20 + 15), paga $30.
    ($this->manual)(15.00, '2026-07-15');
    $primero  = ($this->debe)(20.00, '2026-08-02');
    $segundo  = ($this->debe)(15.00, '2026-08-11');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 30.00, 'cash', null, $this->user->id,
    );

    expect((float) $pago->amount)->toBe(30.0);
    expect($pago->allocations)->toHaveCount(2);

    // El cuaderno queda saldado, el primer servicio a medias, el último intacto.
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(20.0);
    expect($primero->fresh()->payment_status)->toBe('partial');
    expect($segundo->fresh()->payment_status)->toBe('unpaid');
});

test('the derived columns of every touched service are recalculated', function () {
    // Si el pago no sincroniza la fila, la lista del día sigue diciendo
    // "Pendiente" sobre un servicio que ya se cobró.
    $log = ($this->debe)(20.00, '2026-08-02');

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->user->id,
    );

    expect($log->fresh()->payment_status)->toBe('paid');
    expect($log->fresh()->payment_method)->toBe('cash');
    expect($log->fresh()->paid_at)->not->toBeNull();
});

test('a manual debt gets its own allocation', function () {
    $cuaderno = ($this->manual)(15.00, '2026-07-15');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 15.00, 'cash', null, $this->user->id,
    );

    $alloc = $pago->allocations->first();
    expect($alloc->payable_type)->toBe(PaymentAllocationModel::PAYABLE_MANUAL_DEBT);
    expect($alloc->payable_id)->toBe($cuaderno->id);
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('the cashier can correct the split before confirming', function () {
    ($this->manual)(15.00, '2026-07-15');
    $servicio = ($this->debe)(20.00, '2026-08-02');

    // Contra el FIFO: el cajero decide pagar el servicio, no el cuaderno.
    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 15.00, 'cash', null, $this->user->id,
        [['type' => 'service_log', 'id' => $servicio->id, 'amount' => 15.00]],
    );

    expect($pago->allocations)->toHaveCount(1);
    expect($pago->allocations->first()->payable_id)->toBe($servicio->id);
    expect($servicio->fresh()->payment_status)->toBe('partial');
});

test('paying more than owed leaves the rest unallocated', function () {
    // Saldo a favor del cliente, no una deuda pagada de más.
    ($this->debe)(20.00, '2026-08-02');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 50.00, 'cash', null, $this->user->id,
    );

    expect((float) $pago->amount)->toBe(50.0);
    expect($pago->unallocatedAmount())->toBe(30.0);
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('the payment carries the client of the plate', function () {
    ($this->debe)(20.00, '2026-08-02');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->user->id,
    );

    expect($pago->client_id)->toBe($this->user->id);
});

test('a debt payment lands in the open cash session', function () {
    // Cobrar una deuda vieja es plata que entra hoy: tiene que cuadrar el
    // arqueo de hoy.
    $caja = app(\App\Application\Services\CashRegister::class)
        ->openSession($this->tenant->id, now()->toDateString(), 0.00, $this->user->id);
    ($this->debe)(20.00, '2026-08-02');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->user->id,
    );

    expect($pago->cash_session_id)->toBe($caja->id);
    expect(app(\App\Application\Services\CashRegister::class)->expectedFor($caja->fresh()))->toBe(20.0);
});
