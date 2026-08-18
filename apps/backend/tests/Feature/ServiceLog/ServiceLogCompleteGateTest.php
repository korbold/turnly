<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function completeGateSetup(string $businessType): array
{
    $tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => $businessType,
    ]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
        'user_id' => $owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenant->id, 'client_id' => $owner->id, 'type' => 'sedan',
    ]);

    return [$tenant, $owner, $service, $resource];
}

beforeEach(function () {
    [$this->tenant, $this->owner, $this->service, $this->resource] = completeGateSetup('car_wash');

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->log = fn (array $attrs = []) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'status' => 'in_progress',
    ], $attrs));

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('completing without a washer is rejected', function () {
    $log = ($this->log)(['dried_by' => $this->dryer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');

    expect($log->fresh()->status)->toBe('in_progress');
});

test('completing without a dryer is rejected', function () {
    $log = ($this->log)(['washed_by' => $this->washer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');
});

test('completing with both assignees works', function () {
    $log = ($this->log)([
        'washed_by' => $this->washer->id,
        'dried_by'  => $this->dryer->id,
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});

test('a barbershop completes with no assignees at all', function () {
    // El gate es solo de car_wash: en los demás rubros estas columnas no se
    // usan y el endpoint tiene que comportarse igual que siempre.
    [$tenant, $owner, $service, $resource] = completeGateSetup('barbershop');

    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $owner->id,
        'created_by' => $owner->id,
        'status' => 'in_progress',
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});
