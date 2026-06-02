<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->admin = UserModel::factory()->create();
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->admin->id,
        'role'      => 'tenant_admin',
        'is_active' => true,
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('search exposes only public identity and tenant relation for the current tenant', function () {
    $client = UserModel::factory()->create([
        'name' => 'Juan Pérez',
        'email' => 'juan@example.com',
        'phone' => '+593998888888',
    ]);
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id'   => $client->id,
        'role'      => 'client',
        'is_active' => true,
    ]);
    UserBillingProfileModel::create([
        'user_id'    => $client->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1712345678',
        'legal_name' => 'Juan Pérez',
        'email'      => 'juan@example.com',
        'is_default' => true,
    ]);

    $response = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/clients/search?q=Juan');

    $response->assertOk()
        ->assertJsonPath('data.0.tenant_relation', 'client_active')
        ->assertJsonPath('data.0.billing.doc_number', '1712345678');
});

test('search hides clients of other tenants behind not_linked flag', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    $client = UserModel::factory()->create([
        'name' => 'Pedro Rodriguez',
        'email' => 'pedro@example.com',
    ]);
    TenantUserModel::create([
        'tenant_id' => $other->id,
        'user_id'   => $client->id,
        'role'      => 'client',
        'is_active' => true,
    ]);

    $response = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/clients/search?q=Pedro');

    $response->assertOk()
        ->assertJsonPath('data.0.tenant_relation', 'not_linked');
});

test('link-to-tenant is idempotent', function () {
    $client = UserModel::factory()->create();

    $first = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/clients/{$client->id}/link-to-tenant");
    $first->assertOk();

    $second = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/clients/{$client->id}/link-to-tenant");
    $second->assertOk();

    expect(TenantUserModel::where('tenant_id', $this->tenant->id)
        ->where('user_id', $client->id)
        ->count())->toBe(1);
});
