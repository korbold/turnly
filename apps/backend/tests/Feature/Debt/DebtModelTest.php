<?php

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
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);
});

test('a service log can be marked as having left owing', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => 20.00,
        'payment_status' => 'unpaid',
        'left_owing' => true,
    ]);

    expect($log->fresh()->left_owing)->toBeTrue();
});

test('a service log does not leave owing by default', function () {
    // La marca es explícita: sin ella, un impago es un pendiente del día.
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => 20.00,
    ]);

    expect($log->fresh()->left_owing)->toBeFalse();
});

test('a manual debt records what the notebook said and when it happened', function () {
    $d = ManualDebtModel::create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'client_id'          => $this->user->id,
        'amount'             => 45.00,
        'reason'             => '3 lavados de julio, cuaderno',
        'incurred_on'        => '2026-07-15',
        'created_by'         => $this->user->id,
    ]);

    expect((float) $d->fresh()->amount)->toBe(45.0);
    expect($d->fresh()->incurred_on->toDateString())->toBe('2026-07-15');
    // La fecha en que se generó, no la de carga: el dueño carga en agosto
    // una deuda de junio y el reparto tiene que ponerla primero.
    expect($d->incurred_on->toDateString())->not->toBe($d->created_at->toDateString());
});

test('a manual debt can hang off a plate with no client', function () {
    $huerfana = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => null, 'type' => 'sedan',
    ]);

    $d = ManualDebtModel::create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $huerfana->id,
        'client_id' => null,
        'amount' => 12.00,
        'reason' => 'Lavado de la camioneta blanca',
        'incurred_on' => '2026-08-01',
        'created_by' => $this->user->id,
    ]);

    expect($d->fresh()->client_id)->toBeNull();
    expect($d->fresh()->client_resource_id)->toBe($huerfana->id);
});

test('the tenant scope hides another tenants debt', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    ManualDebtModel::create([
        'tenant_id' => $otro->id, 'client_id' => $this->user->id,
        'amount' => 99.00, 'reason' => 'x', 'incurred_on' => '2026-08-01',
    ]);
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 5.00, 'reason' => 'y', 'incurred_on' => '2026-08-01',
    ]);

    expect(ManualDebtModel::count())->toBe(1);
    expect((float) ManualDebtModel::first()->amount)->toBe(5.0);
});

test('an allocation can point at a manual debt', function () {
    // Para esto la tabla nació polimórfica en la fase 1.
    expect(PaymentAllocationModel::PAYABLE_MANUAL_DEBT)->toBe('manual_debt');
});
