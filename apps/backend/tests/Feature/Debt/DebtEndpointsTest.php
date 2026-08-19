<?php

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

    $this->cliente = UserModel::factory()->create(['name' => 'Pablo Perez']);
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->cliente->id, 'type' => 'sedan',
    ]);
    $this->sinDeuda = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->cliente->id, 'type' => 'sedan',
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

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('the debt of a plate lists what makes it up, oldest first', function () {
    ($this->debe)(20.00, '2026-08-02');
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 15.00, 'reason' => 'Cuaderno', 'incurred_on' => '2026-07-15',
    ]);

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk()
        ->assertJsonPath('data.total', 35)
        ->assertJsonPath('data.items.0.type', 'manual_debt')
        ->assertJsonPath('data.items.0.due', 15)
        ->assertJsonPath('data.items.1.type', 'service_log');
});

test('a plate with nothing owed reports zero, not an error', function () {
    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->sinDeuda->id}/debt")
        ->assertOk()
        ->assertJsonPath('data.total', 0)
        ->assertJsonPath('data.items', []);
});

test('the owner loads a debt from the notebook', function () {
    ($this->as)()
        ->postJson('/api/v1/debts/manual', [
            'client_resource_id' => $this->resource->id,
            'amount'             => 45.00,
            'reason'             => '3 lavados de julio',
            'incurred_on'        => '2026-07-15',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.amount', 45)
        ->assertJsonPath('data.incurred_on', '2026-07-15');

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertJsonPath('data.total', 45);
});

test('a manual debt needs a reason and a date', function () {
    // Una deuda sin motivo ni fecha no se puede defender frente al cliente.
    ($this->as)()
        ->postJson('/api/v1/debts/manual', [
            'client_resource_id' => $this->resource->id, 'amount' => 45.00,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason', 'incurred_on']);
});

test('one payment settles the debt through the endpoint', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->debe)(15.00, '2026-08-11');

    ($this->as)()
        ->postJson('/api/v1/debts/payments', [
            'client_resource_id' => $this->resource->id,
            'amount'             => 25.00,
            'method'             => 'cash',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.amount', 25);

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertJsonPath('data.total', 10);
});

test('the clients list carries each plate debt', function () {
    ($this->debe)(20.00, '2026-08-02');

    $res = ($this->as)()->getJson('/api/v1/client-resources?all=1')->assertOk();

    $conDeuda = collect($res->json('data'))->firstWhere('id', $this->resource->id);
    $sinDeuda = collect($res->json('data'))->firstWhere('id', $this->sinDeuda->id);

    expect((float) $conDeuda['debt'])->toBe(20.0);
    expect((float) $sinDeuda['debt'])->toBe(0.0);
});

test('the list can show only the ones who owe', function () {
    ($this->debe)(20.00, '2026-08-02');

    $ids = collect(
        ($this->as)()->getJson('/api/v1/client-resources?all=1&with_debt=1')->assertOk()->json('data')
    )->pluck('id')->all();

    expect($ids)->toBe([$this->resource->id]);
});

test('another tenants plate is not reachable', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    $intruso = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $intruso->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->actingAs($intruso)->withHeader('X-Tenant', $otro->slug)
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertStatus(404);
});
