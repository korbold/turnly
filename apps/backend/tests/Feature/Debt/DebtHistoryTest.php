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

    $this->debe = fn (float $price, string $date) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'left_owing' => true,
        'status' => 'completed',
        'log_date' => $date,
    ]);

    $this->ledger = app(PaymentLedger::class);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('the history keeps a payment after the debt it settled is gone', function () {
    // El bug: la consulta de pagos colgaba de las deudas ABIERTAS, así que un
    // pago desaparecía del historial justo cuando terminaba de saldar algo.
    // Es el único registro de que el cliente pagó.
    ($this->debe)(20.00, '2026-08-02');

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->owner->id,
    );

    $res = ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk();

    expect($res->json('data.total'))->toBe(0);
    expect($res->json('data.items'))->toBe([]);
    expect($res->json('data.payments'))->toHaveCount(1);
    expect((float) $res->json('data.payments.0.amount'))->toBe(20.0);
});

test('the history keeps a payment against a settled manual debt', function () {
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 15.00, 'reason' => 'Cuaderno', 'incurred_on' => '2026-07-15',
    ]);

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 15.00, 'cash', null, $this->owner->id,
    );

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk()
        ->assertJsonPath('data.total', 0)
        ->assertJsonCount(1, 'data.payments');
});

test('the history is newest first', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->debe)(15.00, '2026-08-11');

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 5.00, 'cash', null, $this->owner->id,
    );
    $segundo = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 10.00, 'transfer', 'pichincha', $this->owner->id,
    );

    $res = ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk();

    expect($res->json('data.payments'))->toHaveCount(2);
    expect($res->json('data.payments.0.id'))->toBe($segundo->id);
});

test('another plates payments do not leak into this history', function () {
    $otra = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $otra->id,
        'amount' => 9.00, 'reason' => 'De la otra placa', 'incurred_on' => '2026-08-01',
    ]);
    $this->ledger->recordAgainstResource(
        $this->tenant->id, $otra->id, 9.00, 'cash', null, $this->owner->id,
    );

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk()
        ->assertJsonCount(0, 'data.payments');
});

test('a plate that never owed anything has an empty history', function () {
    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk()
        ->assertJsonCount(0, 'data.payments');
});

test('each payment says what it was applied to', function () {
    // "Efectivo $20" no responde la pregunta del cliente. La que responde es
    // "abonó $15 al cuaderno de julio y $5 al lavado del 2".
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 15.00, 'reason' => 'Cuaderno de julio', 'incurred_on' => '2026-07-15',
    ]);
    ($this->debe)(20.00, '2026-08-02');

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->owner->id,
    );

    $res = ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk();

    $alloc = $res->json('data.payments.0.allocations');
    expect($alloc)->toHaveCount(2);
    expect($alloc[0]['label'])->toBe('Cuaderno de julio');
    expect((float) $alloc[0]['amount'])->toBe(15.0);
    expect((float) $alloc[1]['amount'])->toBe(5.0);
});

test('the breakdown keeps its label after the debt is settled and gone', function () {
    // La etiqueta no puede salir de la lista de deudas abiertas: cuando la
    // deuda se salda desaparece de ahí, y el historial quedaría diciendo
    // "abonó $15 a (nada)".
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 15.00, 'reason' => 'Cuaderno de julio', 'incurred_on' => '2026-07-15',
    ]);

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 15.00, 'cash', null, $this->owner->id,
    );

    $res = ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk();

    expect($res->json('data.total'))->toBe(0);
    expect($res->json('data.payments.0.allocations.0.label'))->toBe('Cuaderno de julio');
});
