<?php

use App\Application\Services\DebtLedger;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
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

    $this->debe = function (float $price, string $date, bool $marked = true) use ($service) {
        return ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->user->id,
            'created_by' => $this->user->id,
            'price_charged' => $price,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'left_owing' => $marked,
            'status' => 'completed',
            'log_date' => $date,
        ]);
    };

    $this->manual = fn (float $amount, string $date) => ManualDebtModel::create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'client_id' => $this->user->id,
        'amount' => $amount,
        'reason' => 'Cuaderno',
        'incurred_on' => $date,
        'created_by' => $this->user->id,
    ]);

    $this->debts  = app(DebtLedger::class);
    $this->ledger = app(PaymentLedger::class);
});

test('a service that left owing is debt', function () {
    ($this->debe)(20.00, '2026-08-02');

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(20.0);
});

test('an unpaid service that was NOT marked is not debt', function () {
    // Es un pendiente del día, no un deudor. Sin esta línea la lista se
    // llena de cobros que nadie cerró.
    ($this->debe)(20.00, '2026-08-02', false);

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('an abono reduces the debt instead of cancelling it', function () {
    $log = ($this->debe)(20.00, '2026-08-02');
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(15.0);
});

test('a manual debt counts the same as a service', function () {
    ($this->manual)(15.00, '2026-07-15');
    ($this->debe)(20.00, '2026-08-02');

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(35.0);
});

test('the outstanding list is ordered oldest first, mixing both sources', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->manual)(15.00, '2026-07-15');
    ($this->debe)(15.00, '2026-08-11');

    $items = $this->debts->outstandingFor($this->tenant->id, $this->resource->id);

    expect(array_column($items, 'type'))->toBe(['manual_debt', 'service_log', 'service_log']);
    expect(array_column($items, 'due'))->toBe([15.0, 20.0, 15.0]);
});

test('the plan spends the payment from the oldest debt down', function () {
    // El ejemplo del spec: debe $50, paga $30.
    ($this->manual)(15.00, '2026-07-15');
    ($this->debe)(20.00, '2026-08-02');
    ($this->debe)(15.00, '2026-08-11');

    $plan = $this->debts->planFor($this->tenant->id, $this->resource->id, 30.00);

    expect($plan)->toHaveCount(2);
    expect($plan[0]['type'])->toBe('manual_debt');
    expect($plan[0]['amount'])->toBe(15.0);
    expect($plan[1]['type'])->toBe('service_log');
    expect($plan[1]['amount'])->toBe(15.0);
});

test('a payment bigger than the debt only plans up to the debt', function () {
    // Lo que sobra es saldo a favor, no una deuda pagada de más.
    ($this->debe)(20.00, '2026-08-02');

    $plan = $this->debts->planFor($this->tenant->id, $this->resource->id, 50.00);

    expect(array_sum(array_column($plan, 'amount')))->toBe(20.0);
});

test('debt by resource answers for the whole tenant at once', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->manual)(15.00, '2026-07-15');

    $otroRecurso = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => null, 'type' => 'sedan',
    ]);
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $otroRecurso->id,
        'amount' => 8.00, 'reason' => 'x', 'incurred_on' => '2026-08-01',
    ]);

    $mapa = $this->debts->debtByResource($this->tenant->id);

    expect($mapa[$this->resource->id])->toBe(35.0);
    expect($mapa[$otroRecurso->id])->toBe(8.0);
});

test('debt by resource costs two queries, not one per row', function () {
    // Con doscientos vehículos, una consulta por fila convierte la pantalla
    // del lunes en un timeout. Este test es el que impide esa regresión.
    ($this->debe)(20.00, '2026-08-02');
    ($this->manual)(15.00, '2026-07-15');

    DB::enableQueryLog();
    $this->debts->debtByResource($this->tenant->id);
    $consultas = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($consultas)->toBeLessThanOrEqual(2);
});

test('a fully paid debt disappears from the list', function () {
    $log = ($this->debe)(20.00, '2026-08-02');
    $this->ledger->recordForServiceLog($log, 20.00, 'cash', null, $this->user->id);

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
    expect($this->debts->outstandingFor($this->tenant->id, $this->resource->id))->toBe([]);
});
