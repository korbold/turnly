<?php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price = 15.00) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
    ]);

    $this->ledger = app(PaymentLedger::class);
});

test('a full payment leaves the log paid', function () {
    $log = ($this->log)(15.00);

    $this->ledger->recordForServiceLog($log, 15.00, 'cash', null, $this->user->id);

    expect($this->ledger->paidFor($log))->toBe(15.0);
    expect($this->ledger->statusFor($log))->toBe('paid');
    expect($log->fresh()->payment_status)->toBe('paid');
    expect($log->fresh()->payment_method)->toBe('cash');
    expect($log->fresh()->paid_at)->not->toBeNull();
});

test('a partial payment leaves the log partial', function () {
    // El abono de la fase 3 ya funciona a nivel de libro: sólo falta la UI.
    $log = ($this->log)(15.00);

    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    expect($this->ledger->paidFor($log))->toBe(5.0);
    expect($this->ledger->statusFor($log))->toBe('partial');
    expect($log->fresh()->payment_status)->toBe('partial');
});

test('two payments add up and close the log', function () {
    $log = ($this->log)(15.00);

    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);
    $this->ledger->recordForServiceLog($log, 10.00, 'transfer', 'pichincha', $this->user->id);

    expect($this->ledger->paidFor($log))->toBe(15.0);
    expect($this->ledger->statusFor($log))->toBe('paid');
    // Las columnas derivadas reflejan el ÚLTIMO pago, que es lo que la fila
    // de la lista muestra.
    expect($log->fresh()->payment_method)->toBe('transfer');
    expect($log->fresh()->payment_bank)->toBe('pichincha');
});

test('a payment writes exactly one allocation against its service', function () {
    $log = ($this->log)(15.00);

    $p = $this->ledger->recordForServiceLog($log, 15.00, 'cash', null, $this->user->id);

    expect($p->allocations)->toHaveCount(1);
    expect($p->allocations->first()->payable_id)->toBe($log->id);
    expect($p->allocations->first()->payable_type)->toBe('service_log');
    expect($p->unallocatedAmount())->toBe(0.0);
});

test('an unpaid log reports zero, not null', function () {
    $log = ($this->log)(15.00);

    expect($this->ledger->paidFor($log))->toBe(0.0);
    expect($this->ledger->statusFor($log))->toBe('unpaid');
});

test('a payment carries the client of the service', function () {
    // La deuda de la fase 4 se apoya en esto: sin client_id no hay saldo.
    $log = ($this->log)(15.00);

    $p = $this->ledger->recordForServiceLog($log, 15.00, 'cash', null, $this->user->id);

    expect($p->client_id)->toBe($this->user->id);
});

test('a payment of more than the total does not overshoot the allocation', function () {
    // Cobrar $20 por un servicio de $15 deja $5 a favor del cliente, no un
    // servicio "pagado de más".
    $log = ($this->log)(15.00);

    $p = $this->ledger->recordForServiceLog($log, 20.00, 'cash', null, $this->user->id);

    expect((float) $p->allocations->first()->amount)->toBe(15.0);
    expect($p->unallocatedAmount())->toBe(5.0);
    expect($this->ledger->statusFor($log))->toBe('paid');
});

test('cents do not break the paid check', function () {
    // 0.1 + 0.2 en float no es 0.3. Un servicio de $0,30 pagado en dos veces
    // tiene que quedar pagado igual.
    $log = ($this->log)(0.30);

    $this->ledger->recordForServiceLog($log, 0.10, 'cash', null, $this->user->id);
    $this->ledger->recordForServiceLog($log, 0.20, 'cash', null, $this->user->id);

    expect($this->ledger->statusFor($log))->toBe('paid');
});
