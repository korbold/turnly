<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogAssignGateTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
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
    $this->admin   = ($this->member)('tenant_admin');
    $this->cashier = ($this->member)('cashier');
    $this->washerUser = ($this->member)('washer');

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->log = fn (string $status = 'in_progress') => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->cashier->id,
        'created_by' => $this->cashier->id,
        'status' => $status,
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->grant = function (string $matrixRole, string $privilege) {
        $settings = $this->tenant->settings ?? [];
        $permissions = $settings['permissions'] ?? [];
        $permissions[$matrixRole][$privilege] = 'full';
        $settings['permissions'] = $permissions;
        $this->tenant->update(['settings' => $settings]);
    };
});

test('a cashier assigns while the service is in progress', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBe($this->washer->id);
});

test('a cashier cannot touch the assignees once completed', function () {
    $log = ($this->log)('completed');

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'ASSIGNEES_LOCKED');

    expect($log->fresh()->washed_by)->toBeNull();
});

test('an admin corrects the assignees after completion', function () {
    $log = ($this->log)('completed');

    ($this->as)($this->admin)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBe($this->washer->id);
});

test('an owner corrects the assignees after completion', function () {
    $log = ($this->log)('completed');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'dried_by' => $this->dryer->id,
        ])
        ->assertOk();
});

test('a washer cannot assign with the default matrix', function () {
    $log = ($this->log)();

    ($this->as)($this->washerUser)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'ASSIGNEES_FORBIDDEN');
});

test('a washer granted Asignados can assign while in progress', function () {
    ($this->grant)('Lavador', 'Asignados');
    $log = ($this->log)();

    ($this->as)($this->washerUser)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();
});

test('a washer granted Asignados is still locked out after completion', function () {
    // El bloqueo post-completado es regla fija, no una casilla de la matriz.
    ($this->grant)('Lavador', 'Asignados');
    $log = ($this->log)('completed');

    ($this->as)($this->washerUser)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'ASSIGNEES_LOCKED');
});

test('each changed position writes one event, and an unchanged one writes none', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
            'dried_by'  => $this->dryer->id,
        ])
        ->assertOk();

    expect(ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED)
        ->count())->toBe(2);

    // Reenviar lo mismo no mueve nada, así que no escribe nada.
    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
            'dried_by'  => $this->dryer->id,
        ])
        ->assertOk();

    expect(ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED)
        ->count())->toBe(2);
});

test('clearing an assignee is a change and is recorded', function () {
    $log = ($this->log)();
    $log->update(['washed_by' => $this->washer->id]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", ['washed_by' => null])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBeNull();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)->latest('changed_at')->first();

    expect($event->detail['from_name'])->toBe('Federman');
    expect($event->detail['to_name'])->toBeNull();
});

test('omitting a field leaves that assignee untouched', function () {
    $log = ($this->log)();
    $log->update(['washed_by' => $this->washer->id, 'dried_by' => $this->dryer->id]);

    // Sólo se manda el secador; el lavador se omite. Omitir un campo tiene que
    // dejarlo intacto incluso cuando ya tiene un valor — ningún otro test cubría
    // eso, porque todos omiten sobre columnas que arrancan en null.
    // (Nota: esto NO distingue has() de filled(); esos dos sólo difieren cuando
    // el campo llega explícito en null, y de eso se ocupa el test de "clearing".)
    $otherDryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Otro Secador', 'position' => 'dryer',
    ]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'dried_by' => $otherDryer->id,
        ])
        ->assertOk();

    $fresh = $log->fresh();
    expect($fresh->washed_by)->toBe($this->washer->id);
    expect($fresh->dried_by)->toBe($otherDryer->id);
});

test('a dryer cannot be assigned as the washer', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->dryer->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});

test('an inactive staff member cannot be assigned', function () {
    $log = ($this->log)();
    $this->washer->update(['is_active' => false]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});
