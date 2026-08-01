<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function everifyTenant(): TenantModel
{
    $t = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $t);
    app()->instance('current_tenant_id', $t->id);
    return $t;
}

function everifyMember(string $tenantId, string $userId, string $role = 'owner'): void
{
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenantId,
        'user_id'   => $userId,
        'role'      => $role,
        'is_active' => true,
    ]);
}

test('email-less unverified staff can reach a verified.email-gated route', function () {
    $t = everifyTenant();
    $staff = UserModel::factory()->create(['email' => null, 'email_verified_at' => null]);
    everifyMember($t->id, $staff->id, 'owner');

    $this->actingAs($staff)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('email-bearing unverified user is still blocked by the verify gate', function () {
    $t = everifyTenant();
    $user = UserModel::factory()->create(['email' => 'pending@example.com', 'email_verified_at' => null]);
    everifyMember($t->id, $user->id, 'owner');

    $this->actingAs($user)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'EMAIL_NOT_VERIFIED');
});

test('verified user passes the gate', function () {
    $t = everifyTenant();
    $user = UserModel::factory()->create(['email' => 'ok@example.com', 'email_verified_at' => now()]);
    everifyMember($t->id, $user->id, 'owner');

    $this->actingAs($user)->withHeader('X-Tenant', $t->slug)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('inviting a username-only staff member marks them verified', function () {
    $t = everifyTenant();
    $owner = UserModel::factory()->create(['email' => 'owner@example.com', 'email_verified_at' => now()]);
    everifyMember($t->id, $owner->id, 'owner');

    $this->actingAs($owner)->withHeader('X-Tenant', $t->slug)
        ->postJson('/api/v1/users/invite', [
            'name'     => 'Caja Uno',
            'username' => 'caja.uno',
            'password' => 'secret123',
            'role'     => 'cashier',
        ])
        ->assertStatus(201);

    $created = UserModel::where('username', 'caja.uno')->first();
    expect($created)->not->toBeNull();
    expect($created->email_verified_at)->not->toBeNull();
});
