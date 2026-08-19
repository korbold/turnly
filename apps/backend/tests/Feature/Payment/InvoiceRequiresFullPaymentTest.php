<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
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

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 30.00]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (array $extra = []) => ($this->as)()
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 30.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('a partly paid service cannot be invoiced', function () {
    // Una factura del SRI es por el total, y desde 2026 una a consumidor final
    // no se puede anular nunca. El error sería irreversible.
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/invoice")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_INCOMPLETE');
});

test('an unpaid service cannot be invoiced either', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/invoice")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_INCOMPLETE');
});

test('the error says how much is missing', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $res = ($this->as)()->postJson("/api/v1/service-logs/{$id}/invoice");

    expect($res->json('error.message'))->toContain('20');
});
