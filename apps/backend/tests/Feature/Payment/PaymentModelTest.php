<?php

use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->user = UserModel::factory()->create();
});

test('a payment records what came in, with its method and who took it', function () {
    $p = PaymentModel::create([
        'tenant_id'   => $this->tenant->id,
        'client_id'   => null,
        'amount'      => 5.00,
        'method'      => 'cash',
        'bank'        => null,
        'paid_at'     => now(),
        'received_by' => $this->user->id,
    ]);

    expect((float) $p->fresh()->amount)->toBe(5.0);
    expect($p->method)->toBe('cash');
    expect($p->received_by)->toBe($this->user->id);
});

test('an allocation says how much of a payment cancels which service', function () {
    $p = PaymentModel::create([
        'tenant_id' => $this->tenant->id, 'amount' => 20.00, 'method' => 'cash',
        'paid_at' => now(), 'received_by' => $this->user->id,
    ]);

    $a = PaymentAllocationModel::create([
        'tenant_id'    => $this->tenant->id,
        'payment_id'   => $p->id,
        'payable_type' => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
        'payable_id'   => (string) \Illuminate\Support\Str::uuid(),
        'amount'       => 12.50,
    ]);

    expect((float) $a->fresh()->amount)->toBe(12.5);
    expect($p->fresh()->allocations)->toHaveCount(1);
});

test('the tenant scope hides another tenants payments', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    PaymentModel::create([
        'tenant_id' => $other->id, 'amount' => 1, 'method' => 'cash',
        'paid_at' => now(), 'received_by' => $this->user->id,
    ]);
    PaymentModel::create([
        'tenant_id' => $this->tenant->id, 'amount' => 2, 'method' => 'cash',
        'paid_at' => now(), 'received_by' => $this->user->id,
    ]);

    expect(PaymentModel::count())->toBe(1);
    expect((float) PaymentModel::first()->amount)->toBe(2.0);
});

test('payment_status on a service log accepts partial', function () {
    // La columna era enum('unpaid','paid'). El abono la necesita ancha, y
    // ensancharla ahora evita una migración en medio de esa feature.
    $col = \Illuminate\Support\Facades\Schema::getColumnType('service_logs', 'payment_status');
    expect($col)->toBeIn(['string', 'varchar']);
});
