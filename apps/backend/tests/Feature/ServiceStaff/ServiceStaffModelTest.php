<?php
// apps/backend/tests/Feature/ServiceStaff/ServiceStaffModelTest.php

use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('a staff member is created active by default', function () {
    $staff = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Federman Paspuel',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);

    expect($staff->is_active)->toBeTrue();
    expect($staff->position)->toBe('washer');
});

test('forPosition returns the exact position plus both, active only', function () {
    $washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);
    $dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis',
        'position'  => ServiceStaffModel::POSITION_DRYER,
    ]);
    $both = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Jorge',
        'position'  => ServiceStaffModel::POSITION_BOTH,
    ]);
    $inactive = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Renunció',
        'position'  => ServiceStaffModel::POSITION_WASHER, 'is_active' => false,
    ]);

    $ids = ServiceStaffModel::forPosition(ServiceStaffModel::POSITION_WASHER)
        ->pluck('id')->all();

    expect($ids)->toContain($washer->id)
        ->toContain($both->id)
        ->not->toContain($dryer->id)
        ->not->toContain($inactive->id);
});

test('the tenant scope hides another tenants staff', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    ServiceStaffModel::create([
        'tenant_id' => $other->id, 'name' => 'Ajeno',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);
    ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Propio',
        'position'  => ServiceStaffModel::POSITION_WASHER,
    ]);

    expect(ServiceStaffModel::pluck('name')->all())->toBe(['Propio']);
});
