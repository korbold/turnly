<?php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

// Igual que el resto de tests/Feature/Report: `whereBetween` sobre log_date no
// encuentra nada en SQLite, así que esta suite corre contra MySQL o no corre.
beforeEach(function () {
    if (config('database.default') === 'sqlite') {
        $this->markTestSkipped('Los reportes se prueban contra MySQL: en SQLite log_date conserva la hora y whereBetween no encuentra nada.');
    }

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => now()->toDateString(),
    ]);

    $this->ledger = app(PaymentLedger::class);
    $this->hoy = now()->toDateString();

    $this->range = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/range?date_from={$this->hoy}&date_to={$this->hoy}");
});

test('the method bucket counts money received, not the price of the service', function () {
    $log = ($this->log)(30.00);
    $this->ledger->recordForServiceLog($log, 10.00, 'cash', null, $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.by_payment_method.cash.total', 10);
});

test('a partial payment is not silently counted as collected', function () {
    // El que muerde en silencio: `where('payment_status','unpaid')` deja fuera
    // a un log 'partial', y collected = total − unpaid se come los $30.
    $log = ($this->log)(30.00);
    $this->ledger->recordForServiceLog($log, 10.00, 'cash', null, $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.stats.collected_revenue', 10)
        ->assertJsonPath('data.stats.unpaid_revenue', 20)
        ->assertJsonPath('data.stats.total_revenue', 30);
});

test('the bank breakdown counts money received too', function () {
    $log = ($this->log)(40.00);
    $this->ledger->recordForServiceLog($log, 25.00, 'transfer', 'pichincha', $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.by_bank.pichincha.total', 25);
});

test('a fully paid day reports exactly what it reported before', function () {
    // El criterio de no-regresión: con pagos completos, sumar montos y sumar
    // precios da lo mismo.
    $a = ($this->log)(15.00);
    $b = ($this->log)(25.00);
    $this->ledger->recordForServiceLog($a, 15.00, 'cash', null, $this->owner->id);
    $this->ledger->recordForServiceLog($b, 25.00, 'card', null, $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.by_payment_method.cash.total', 15)
        ->assertJsonPath('data.by_payment_method.card.total', 25)
        ->assertJsonPath('data.stats.collected_revenue', 40)
        ->assertJsonPath('data.stats.unpaid_revenue', 0);
});

test('the monthly report counts money received', function () {
    $log = ($this->log)(30.00);
    $this->ledger->recordForServiceLog($log, 10.00, 'cash', null, $this->owner->id);

    $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/reports/monthly?month=' . now()->format('Y-m'))
        ->assertOk()
        ->assertJsonPath('data.by_payment_method.cash', 10);
});
