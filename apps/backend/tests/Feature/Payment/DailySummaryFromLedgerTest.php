<?php

use App\Application\Services\PaymentLedger;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
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
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price, string $date) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => $date,
    ]);

    $this->ledger = app(PaymentLedger::class);
    $this->repo   = app(ServiceLogRepositoryInterface::class);
});

test('the cash tile sums money received, not service prices', function () {
    $hoy = now()->toDateString();
    $log = ($this->log)(15.00, $hoy);

    // Abono de $5: al cajón entraron $5, no $15.
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    $summary = $this->repo->getDailySummary($this->tenant->id, $hoy);

    expect($summary['by_payment_method']['cash']['total'])->toBe(5.0);
});

test('each method lands in its own tile', function () {
    $hoy = now()->toDateString();
    $a = ($this->log)(10.00, $hoy);
    $b = ($this->log)(20.00, $hoy);

    $this->ledger->recordForServiceLog($a, 10.00, 'cash', null, $this->user->id);
    $this->ledger->recordForServiceLog($b, 20.00, 'transfer', 'pichincha', $this->user->id);

    $summary = $this->repo->getDailySummary($this->tenant->id, $hoy);

    expect($summary['by_payment_method']['cash']['total'])->toBe(10.0);
    expect($summary['by_payment_method']['transfer']['total'])->toBe(20.0);
    expect($summary['by_payment_method']['card']['total'])->toBe(0.0);
});

test('money follows the day it was collected, not the day of the service', function () {
    // Un lavado del lunes cobrado el martes es plata del martes. Sin esto la
    // caja del martes nunca cuadraría.
    $ayer = now()->subDay()->toDateString();
    $hoy  = now()->toDateString();

    $log = ($this->log)(12.00, $ayer);
    $this->ledger->recordForServiceLog($log, 12.00, 'cash', null, $this->user->id, now());

    expect($this->repo->getDailySummary($this->tenant->id, $ayer)['by_payment_method']['cash']['total'])->toBe(0.0);
    expect($this->repo->getDailySummary($this->tenant->id, $hoy)['by_payment_method']['cash']['total'])->toBe(12.0);
});

test('collected counts what came in', function () {
    $hoy = now()->toDateString();
    $log = ($this->log)(15.00, $hoy);
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    expect($this->repo->getDailySummary($this->tenant->id, $hoy)['collected']['total'])->toBe(5.0);
});
