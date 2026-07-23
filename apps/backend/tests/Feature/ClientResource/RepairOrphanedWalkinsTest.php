<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

function runRepairOrphanedWalkins(): void
{
    $migration = require base_path('database/migrations/2026_07_23_000002_repair_orphaned_walkin_clients.php');
    $migration->up();
}

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'barbershop']);
    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
});

test('repair reassigns a walk-in mis-saved under a staff id to a real client user', function () {
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->owner->id, // pre-fix bug: saved under the admin
        'data' => ['nombre' => 'Ana Torres', 'telefono' => '0988888888'],
    ]);

    runRepairOrphanedWalkins();

    $newClientId = $resource->fresh()->client_id;
    expect($newClientId)->not->toBe($this->owner->id);

    $client = UserModel::find($newClientId);
    expect($client->name)->toBe('Ana Torres');
    expect(TenantUserModel::where('user_id', $newClientId)->where('tenant_id', $this->tenant->id)->value('role'))
        ->toBe('client');
});

test('repair leaves a genuine client-owned resource untouched', function () {
    $client = UserModel::factory()->create();
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $client->id,
        'role' => 'client',
        'is_active' => true,
    ]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $client->id,
        'data' => ['nombre' => 'Beto'],
    ]);

    runRepairOrphanedWalkins();

    expect($resource->fresh()->client_id)->toBe($client->id);
});

test('repair skips staff-owned resources that have no name in data', function () {
    // A staff member's own vehicle (no `nombre`) must not be turned into a client.
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->owner->id,
        'data' => ['telefono' => '0977777777'],
    ]);

    runRepairOrphanedWalkins();

    expect($resource->fresh()->client_id)->toBe($this->owner->id);
});
