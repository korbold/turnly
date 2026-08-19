<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (array $attrs) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
    ], $attrs));

    // La migración de backfill ya corrió en el setup de la suite, así que se
    // la vuelve a invocar a mano sobre las filas que este test crea.
    $this->runBackfill = function () {
        $migration = require base_path('database/migrations/2026_08_19_100004_backfill_payments_from_service_logs.php');
        $migration->up();
    };
});

test('a paid service becomes one payment for its full price', function () {
    $log = ($this->log)([
        'price_charged' => 12.50, 'payment_status' => 'paid',
        'payment_method' => 'cash', 'paid_at' => now()->subDay(),
    ]);

    ($this->runBackfill)();

    $payment = PaymentModel::withoutGlobalScopes()->first();
    expect((float) $payment->amount)->toBe(12.5);
    expect($payment->method)->toBe('cash');
    expect($payment->received_by)->toBe($this->user->id);
    expect($payment->paid_at->toDateString())->toBe(now()->subDay()->toDateString());

    $alloc = PaymentAllocationModel::withoutGlobalScopes()->first();
    expect($alloc->payable_id)->toBe($log->id);
    expect((float) $alloc->amount)->toBe(12.5);
});

test('an unpaid service produces no payment', function () {
    ($this->log)([
        'price_charged' => 12.50, 'payment_status' => 'unpaid',
        'payment_method' => null, 'paid_at' => null,
    ]);

    ($this->runBackfill)();

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
});

test('the backfill is idempotent', function () {
    // Correrla dos veces no puede duplicar la historia: una migración se
    // vuelve a correr más seguido de lo que uno cree.
    ($this->log)([
        'price_charged' => 12.50, 'payment_status' => 'paid',
        'payment_method' => 'cash', 'paid_at' => now(),
    ]);

    ($this->runBackfill)();
    ($this->runBackfill)();

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(1);
});

test('the collected total is identical before and after', function () {
    // El criterio de éxito de toda la fase: los números no cambian.
    foreach ([['cash', 10.00], ['card', 25.50], ['transfer', 8.25]] as [$method, $price]) {
        ($this->log)([
            'price_charged' => $price, 'payment_status' => 'paid',
            'payment_method' => $method, 'paid_at' => now(),
        ]);
    }
    ($this->log)(['price_charged' => 99.00, 'payment_status' => 'unpaid', 'paid_at' => null]);

    $antes = (float) ServiceLogModel::withoutGlobalScopes()
        ->where('payment_status', 'paid')->sum('price_charged');

    ($this->runBackfill)();

    $despues = (float) PaymentModel::withoutGlobalScopes()->sum('amount');

    expect($despues)->toBe($antes);
    expect($despues)->toBe(43.75);
});

test('a paid service with no method falls back to cash', function () {
    // Filas viejas con method null existen. Sin un valor, el pago quedaría
    // fuera de todo agrupamiento por método y la caja perdería plata.
    ($this->log)([
        'price_charged' => 5.00, 'payment_status' => 'paid',
        'payment_method' => null, 'paid_at' => now(),
    ]);

    ($this->runBackfill)();

    expect(PaymentModel::withoutGlobalScopes()->first()->method)->toBe('cash');
});
