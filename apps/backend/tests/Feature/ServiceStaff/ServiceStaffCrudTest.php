<?php
// apps/backend/tests/Feature/ServiceStaff/ServiceStaffCrudTest.php

use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
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

    $this->owner   = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('an owner creates a staff member', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-staff', [
            'name' => 'Federman Paspuel', 'position' => 'washer',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.name', 'Federman Paspuel')
        ->assertJsonPath('data.position', 'washer')
        ->assertJsonPath('data.is_active', true);
});

test('a cashier cannot create a staff member', function () {
    ($this->as)($this->cashier)
        ->postJson('/api/v1/service-staff', ['name' => 'Federman', 'position' => 'washer'])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'FORBIDDEN');

    expect(ServiceStaffModel::count())->toBe(0);
});

test('a cashier can read the catalog because the select needs it', function () {
    ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/service-staff')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('the list filters by position and includes both', function () {
    foreach ([['Federman', 'washer'], ['Luis', 'dryer'], ['Jorge', 'both']] as [$name, $position]) {
        ServiceStaffModel::create([
            'tenant_id' => $this->tenant->id, 'name' => $name, 'position' => $position,
        ]);
    }

    $names = ($this->as)($this->owner)
        ->getJson('/api/v1/service-staff?position=dryer')
        ->assertOk()
        ->json('data.*.name');

    expect($names)->toEqualCanonicalizing(['Luis', 'Jorge']);
});

test('an owner deactivates a staff member instead of deleting one', function () {
    $staff = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Renunció', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-staff/{$staff->id}", ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    // La fila sigue ahí: los servicios que hizo tienen que poder nombrarla.
    expect(ServiceStaffModel::withoutGlobalScopes()->find($staff->id))->not->toBeNull();
});

test('there is no route to delete a staff member', function () {
    $staff = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-staff/{$staff->id}")
        ->assertStatus(405);
});

test('an invalid position is rejected', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-staff', ['name' => 'Federman', 'position' => 'pulidor'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['position']);
});

test('another tenants staff is invisible', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    ServiceStaffModel::create([
        'tenant_id' => $other->id, 'name' => 'Ajeno', 'position' => 'washer',
    ]);

    ($this->as)($this->owner)
        ->getJson('/api/v1/service-staff')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
