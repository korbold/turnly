<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

/**
 * A cashier's work has to be attributed to the cashier. Disabling the picker in
 * the UI is a suggestion; a crafted request could still hand the service to
 * someone else, which is exactly what commissions and per-employee reports read.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');
    $this->otherCashier = ($this->member)('cashier');

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $client = UserModel::factory()->create();
    $this->resource = ClientResourceModel::create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $client->id,
        'data' => ['plate' => 'IBB9762'],
    ]);
});

function postLogAs(UserModel $actor, string $attendedBy)
{
    return test()
        ->actingAs($actor)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => test()->resource->id,
            'service_id' => test()->service->id,
            'attended_by' => $attendedBy,
            'price_charged' => 15,
            'payment_method' => 'cash',
        ]);
}

test('a cashier registering for someone else is recorded as themselves', function () {
    postLogAs($this->cashier, $this->otherCashier->id)->assertCreated();

    expect(ServiceLogModel::withoutGlobalScopes()->first()->attended_by)
        ->toBe($this->cashier->id);
});

test('a cashier registering for themselves is unaffected', function () {
    postLogAs($this->cashier, $this->cashier->id)->assertCreated();

    expect(ServiceLogModel::withoutGlobalScopes()->first()->attended_by)
        ->toBe($this->cashier->id);
});

test('an owner may still attribute the work to any employee', function () {
    postLogAs($this->owner, $this->cashier->id)->assertCreated();

    expect(ServiceLogModel::withoutGlobalScopes()->first()->attended_by)
        ->toBe($this->cashier->id);
});

test('a cashier cannot reassign an existing log by editing it', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->cashier->id,
        'created_by' => $this->cashier->id,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
        'log_date' => now()->toDateString(),
    ]);

    $this->actingAs($this->cashier)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/service-logs/{$log->id}", [
            'attended_by' => $this->otherCashier->id,
        ])
        ->assertOk();

    expect($log->fresh()->attended_by)->toBe($this->cashier->id);
});

test('an owner may reassign an existing log', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->cashier->id,
        'created_by' => $this->cashier->id,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
        'log_date' => now()->toDateString(),
    ]);

    $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/service-logs/{$log->id}", [
            'attended_by' => $this->otherCashier->id,
        ])
        ->assertOk();

    expect($log->fresh()->attended_by)->toBe($this->otherCashier->id);
});
