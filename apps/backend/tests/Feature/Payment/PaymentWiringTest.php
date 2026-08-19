<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
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

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 10.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (array $extra = []) => ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('registering a service paid at the counter writes a payment', function () {
    $id = ($this->register)()->json('data.id');

    $payment = PaymentModel::withoutGlobalScopes()->first();
    expect((float) $payment->amount)->toBe(10.0);
    expect($payment->method)->toBe('cash');
    expect($payment->received_by)->toBe($this->owner->id);

    $alloc = PaymentAllocationModel::withoutGlobalScopes()->first();
    expect($alloc->payable_id)->toBe($id);
});

test('registering to be paid later writes no payment', function () {
    ($this->register)(['payment_status' => 'unpaid']);

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
});

test('collecting later writes the payment and closes the log', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    ($this->as)($this->owner)
        ->postJson("/api/v1/service-logs/{$id}/payment", [
            'method' => 'transfer', 'bank' => 'pichincha',
        ])
        ->assertOk();

    $payment = PaymentModel::withoutGlobalScopes()->first();
    expect((float) $payment->amount)->toBe(10.0);
    expect($payment->method)->toBe('transfer');
    expect($payment->bank)->toBe('pichincha');

    expect(\App\Infrastructure\Persistence\Models\ServiceLogModel::withoutGlobalScopes()
        ->find($id)->payment_status)->toBe('paid');
});

test('the log columns still mirror the payment', function () {
    // Los filtros de la lista, los tiles y la facturación las leen. Si dejan
    // de reflejar el libro, todo eso miente sin avisar.
    $id = ($this->register)()->json('data.id');

    $log = \App\Infrastructure\Persistence\Models\ServiceLogModel::withoutGlobalScopes()->find($id);
    expect($log->payment_status)->toBe('paid');
    expect($log->payment_method)->toBe('cash');
    expect($log->paid_at)->not->toBeNull();
});

test('the trail still records the payment', function () {
    // La bitácora es una feature aparte y no debe romperse al mover el pago.
    $id = ($this->register)()->json('data.id');

    $eventos = \App\Infrastructure\Persistence\Models\ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)->pluck('event')->all();

    expect($eventos)->toContain('payment_recorded');
});
