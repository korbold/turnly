<?php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price, bool $leftOwing = false) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'left_owing' => $leftOwing,
        'log_date' => now()->toDateString(),
    ]);

    $this->deudaVieja = fn (float $amount) => ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => $amount, 'reason' => 'Cartera anterior', 'incurred_on' => '2025-02-06',
    ]);

    $this->ledger = app(PaymentLedger::class);

    $this->rows = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/service-logs?date=' . now()->toDateString())
        ->assertOk()
        ->json('data');
});

test('a row carries what the plate owes from before', function () {
    ($this->deudaVieja)(832.00);
    ($this->log)(20.00);

    expect((float) ($this->rows)()[0]['other_debt'])->toBe(832.0);
});

test('a plate with no debt reports zero, not null', function () {
    ($this->log)(20.00);

    expect((float) ($this->rows)()[0]['other_debt'])->toBe(0.0);
});

test('the row does not count itself as debt from before', function () {
    // El servicio que se fue debiendo ya lo grita en su propia columna. Que
    // además apareciera en "debe de antes" contaría la misma plata dos veces.
    ($this->deudaVieja)(832.00);
    ($this->log)(20.00, true);

    $row = ($this->rows)()[0];
    expect((float) $row['amount_due'])->toBe(20.0);
    expect((float) $row['other_debt'])->toBe(832.0);
});

test('an abono on this row does not change what it owes from before', function () {
    ($this->deudaVieja)(100.00);
    $log = ($this->log)(20.00, true);
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->owner->id);

    $row = collect(($this->rows)())->firstWhere('id', $log->id);
    expect((float) $row['amount_due'])->toBe(15.0);
    expect((float) $row['other_debt'])->toBe(100.0);
});

test('two rows of the same plate report the same debt from before', function () {
    ($this->deudaVieja)(50.00);
    ($this->log)(20.00);
    ($this->log)(30.00);

    $rows = ($this->rows)();
    expect(count($rows))->toBe(2);
    foreach ($rows as $r) {
        expect((float) $r['other_debt'])->toBe(50.0);
    }
});
