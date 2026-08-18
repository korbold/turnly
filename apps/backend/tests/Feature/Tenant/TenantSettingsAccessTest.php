<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

/**
 * The permissions matrix lives in tenant settings and now grants privileges
 * that move money (Precio, Eliminar). Whoever can write settings can grant
 * them to themselves — so writing is owner/admin only, while reading stays
 * open to every member (the sidebar and the matrix are needed to render the
 * app at all).
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id'        => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'user_id'   => $user->id,
            'role'      => $role,
            'is_active' => true,
        ]);
        return $user;
    };

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('a cashier cannot grant themselves the price privilege', function () {
    $cashier = ($this->member)('cashier');

    ($this->as)($cashier)
        ->patchJson('/api/v1/tenant/settings', [
            'permissions' => ['Cajero' => ['Precio' => 'full', 'Eliminar' => 'full']],
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'FORBIDDEN');

    expect($this->tenant->fresh()->settings['permissions'] ?? null)->toBeNull();
});

test('a washer cannot edit settings either', function () {
    $washer = ($this->member)('washer');

    ($this->as)($washer)
        ->patchJson('/api/v1/tenant/settings', ['name' => 'Renombrado'])
        ->assertStatus(403);

    expect($this->tenant->fresh()->name)->not->toBe('Renombrado');
});

test('a cashier can still read settings', function () {
    $cashier = ($this->member)('cashier');

    ($this->as)($cashier)
        ->getJson('/api/v1/tenant/settings')
        ->assertOk();
});

test('an admin can edit the permissions matrix', function () {
    $admin = ($this->member)('tenant_admin');

    ($this->as)($admin)
        ->patchJson('/api/v1/tenant/settings', [
            'permissions' => ['Cajero' => ['Precio' => 'full']],
        ])
        ->assertOk();

    expect($this->tenant->fresh()->settings['permissions']['Cajero']['Precio'])->toBe('full');
});

test('an owner can edit the permissions matrix', function () {
    $owner = ($this->member)('owner');

    ($this->as)($owner)
        ->patchJson('/api/v1/tenant/settings', [
            'permissions' => ['Lavador' => ['Eliminar' => 'full']],
        ])
        ->assertOk();

    expect($this->tenant->fresh()->settings['permissions']['Lavador']['Eliminar'])->toBe('full');
});
