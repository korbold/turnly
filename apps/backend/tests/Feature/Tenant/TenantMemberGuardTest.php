<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function guardTenant(): TenantModel
{
    $t = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $t);
    app()->instance('current_tenant_id', $t->id);
    return $t;
}

function memberRow(string $tenantId, string $userId, string $role = 'owner', bool $active = true): void
{
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenantId,
        'user_id'   => $userId,
        'role'      => $role,
        'is_active' => $active,
    ]);
}

test('active member can access a guarded staff route', function () {
    $t = guardTenant();
    $owner = UserModel::factory()->create();
    memberRow($t->id, $owner->id, 'owner', true);

    $this->actingAs($owner)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('non-member is blocked from a guarded staff route', function () {
    $t = guardTenant();
    $stranger = UserModel::factory()->create();

    $this->actingAs($stranger)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});

test('deactivated member is blocked from a guarded staff route', function () {
    $t = guardTenant();
    $user = UserModel::factory()->create();
    memberRow($t->id, $user->id, 'cashier', false);

    $this->actingAs($user)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});

test('super admin passes the guard without a membership row', function () {
    $t = guardTenant();
    $admin = UserModel::factory()->superAdmin()->create();

    $this->actingAs($admin)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('auth/me is NOT guarded so a non-member still gets a response', function () {
    $t = guardTenant();
    $stranger = UserModel::factory()->create();

    $this->actingAs($stranger)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.tenant', null);
});

test('cross-tenant access is blocked: a member of A cannot use B', function () {
    $tenantA = TenantModel::factory()->create(['status' => 'active']);
    $tenantB = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    memberRow($tenantA->id, $user->id, 'owner', true);

    app()->instance('current_tenant', $tenantB);
    app()->instance('current_tenant_id', $tenantB->id);

    $this->actingAs($user)->withHeader('X-Tenant', $tenantB->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});

test('a guarded route with no resolved tenant is blocked', function () {
    $user = UserModel::factory()->create(); // email-verified by factory; no membership, no tenant bound

    $this->actingAs($user)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
});
