<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

/**
 * Two privileges inside Registro Diario are granted per role in the
 * permissions matrix: setting what a service costs (Precio) and erasing a row
 * from the day (Eliminar). Both default to Admin-only. The UI hides the
 * controls; these cover the half that actually holds.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->owner  = UserModel::factory()->create();
    $this->cashier = UserModel::factory()->create();

    // $10 is the catalog price for the rest of this file.
    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'price'     => 10.00,
    ]);

    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->owner->id,
        'type'      => 'sedan',
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    foreach ([[$this->owner, 'owner'], [$this->cashier, 'cashier']] as [$user, $role]) {
        TenantUserModel::create([
            'id'        => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'user_id'   => $user->id,
            'role'      => $role,
            'is_active' => true,
        ]);
    }

    $this->log = fn (array $attrs = []) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->cashier->id,
        'created_by'         => $this->cashier->id,
        'payment_status'     => 'unpaid',
        'paid_at'            => null,
        'invoice_status'     => null,
    ], $attrs));

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);

    // Hands a matrix row the privilege the owner would tick in Configuración.
    $this->grant = function (string $matrixRole, string $privilege) {
        $settings = $this->tenant->settings ?? [];
        $permissions = $settings['permissions'] ?? [];
        $permissions[$matrixRole][$privilege] = 'full';
        $settings['permissions'] = $permissions;
        $this->tenant->update(['settings' => $settings]);
    };
});

// ── eliminación ──────────────────────────────────────────────────────────────

test('a cashier cannot delete a service log', function () {
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'FORBIDDEN');

    $this->assertDatabaseHas('service_logs', ['id' => $log->id]);
});

test('an owner can delete an unpaid service log', function () {
    $log = ($this->log)();

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertOk();

    $this->assertDatabaseMissing('service_logs', ['id' => $log->id]);
});

// ── precio al registrar ──────────────────────────────────────────────────────

test('a cashier cannot register a service above the catalog price without a reason', function () {
    ($this->as)($this->cashier)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->clientResource->id,
            'attended_by'        => $this->cashier->id,
            'items'              => [[
                'service_id' => $this->service->id,
                'label'      => 'Lavado express',
                'qty'        => 1,
                'unit_price' => 25.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');

    $this->assertDatabaseCount('service_logs', 0);
});

test('a cashier can register a service at the catalog price', function () {
    ($this->as)($this->cashier)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->clientResource->id,
            'attended_by'        => $this->cashier->id,
            'items'              => [[
                'service_id' => $this->service->id,
                'label'      => 'Lavado express',
                'qty'        => 2,
                'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_charged', 20);
});

test('an owner can register a service at a discounted price', function () {
    ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->clientResource->id,
            'attended_by'        => $this->cashier->id,
            'items'              => [[
                'service_id' => $this->service->id,
                'label'      => 'Lavado express',
                'qty'        => 1,
                'unit_price' => 6.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_charged', 6);
});

// ── precio al editar ─────────────────────────────────────────────────────────

test('a cashier cannot re-price a line on an existing log without a reason', function () {
    $log = ($this->log)(['price_charged' => 10.00]);
    ServiceLogItemModel::create([
        'tenant_id'      => $this->tenant->id,
        'service_log_id' => $log->id,
        'item_type'      => 'service_variant',
        'ref_id'         => $this->service->id,
        'label'          => 'Lavado express',
        'qty'            => 1,
        'unit_price'     => 10.00,
        'line_total'     => 10.00,
        'sort_order'     => 0,
    ]);

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$log->id}/items", [
            'items' => [[
                'service_id' => $this->service->id,
                'label'      => 'Lavado express',
                'qty'        => 1,
                'unit_price' => 3.00,
            ]],
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');

    expect((float) $log->fresh()->price_charged)->toBe(10.00);
});

test("a cashier's edit keeps the price the admin already discounted", function () {
    // The admin sold this at $6. A cashier fixing the qty must not have that
    // reverted to the $10 catalog price behind their back.
    $log = ($this->log)(['price_charged' => 6.00]);
    ServiceLogItemModel::create([
        'tenant_id'      => $this->tenant->id,
        'service_log_id' => $log->id,
        'item_type'      => 'service_variant',
        'ref_id'         => $this->service->id,
        'label'          => 'Lavado express',
        'qty'            => 1,
        'unit_price'     => 6.00,
        'line_total'     => 6.00,
        'sort_order'     => 0,
    ]);

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$log->id}/items", [
            'items' => [[
                'service_id' => $this->service->id,
                'label'      => 'Lavado express',
                'qty'        => 2,
                'unit_price' => 6.00,
            ]],
        ])
        ->assertOk();

    expect((float) $log->fresh()->price_charged)->toBe(12.00);
});

test('a cashier can add a new line at the catalog price', function () {
    $log = ($this->log)(['price_charged' => 10.00]);
    $second = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'price'     => 4.00,
    ]);

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$log->id}/items", [
            'items' => [
                ['service_id' => $this->service->id, 'label' => 'Lavado express', 'qty' => 1, 'unit_price' => 10.00],
                ['service_id' => $second->id,        'label' => 'Aspirado',       'qty' => 1, 'unit_price' => 4.00],
            ],
        ])
        ->assertOk();

    expect((float) $log->fresh()->price_charged)->toBe(14.00);
});

test('a cashier cannot patch price_charged directly', function () {
    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 1.00])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PRICE_LOCKED');

    expect((float) $log->fresh()->price_charged)->toBe(10.00);
});

test('a cashier can still edit the notes on a log', function () {
    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['notes' => 'Cliente espera en sala'])
        ->assertOk();

    expect($log->fresh()->notes)->toBe('Cliente espera en sala');
});

// ── otorgado en la matriz ────────────────────────────────────────────────────

test('a cashier granted Precio in the matrix can re-price a line', function () {
    ($this->grant)('Cajero', 'Precio');

    $log = ($this->log)(['price_charged' => 10.00]);
    ServiceLogItemModel::create([
        'tenant_id'      => $this->tenant->id,
        'service_log_id' => $log->id,
        'item_type'      => 'service_variant',
        'ref_id'         => $this->service->id,
        'label'          => 'Lavado express',
        'qty'            => 1,
        'unit_price'     => 10.00,
        'line_total'     => 10.00,
        'sort_order'     => 0,
    ]);

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$log->id}/items", [
            'items' => [[
                'service_id' => $this->service->id,
                'label'      => 'Lavado express',
                'qty'        => 1,
                'unit_price' => 3.00,
            ]],
        ])
        ->assertOk();

    expect((float) $log->fresh()->price_charged)->toBe(3.00);
});

test('a cashier granted Eliminar in the matrix can delete a log', function () {
    ($this->grant)('Cajero', 'Eliminar');
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertOk();

    $this->assertDatabaseMissing('service_logs', ['id' => $log->id]);
});

test('the two privileges are granted independently', function () {
    // Precio only: the price opens, deletion stays shut.
    ($this->grant)('Cajero', 'Precio');
    $log = ($this->log)();

    ($this->as)($this->cashier)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertStatus(403);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 4.00])
        ->assertOk();
});

test('granting a washer Precio does not grant it to the cashier', function () {
    ($this->grant)('Lavador', 'Precio');
    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 1.00])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PRICE_LOCKED');
});

test('a matrix that predates the columns keeps the price shut', function () {
    // A tenant that saved its permissions before Precio/Eliminar existed: the
    // row is there, the privilege keys are not. Must not read as granted.
    $this->tenant->update(['settings' => ['permissions' => [
        'Cajero' => ['Dashboard' => 'view', 'Registro' => 'full'],
    ]]]);

    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($this->cashier)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 1.00])
        ->assertStatus(403);

    ($this->as)($this->cashier)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertStatus(403);
});

test('an admin keeps both privileges without any matrix saved', function () {
    $admin = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $admin->id,
        'role'      => 'tenant_admin',
        'is_active' => true,
    ]);

    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($admin)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 2.00])
        ->assertOk();

    ($this->as)($admin)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertOk();
});

test('an admin the owner stripped of Precio loses it', function () {
    // The matrix is the authority, not the role name: an owner who unticks
    // Admin · Precio means it.
    $admin = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $admin->id,
        'role'      => 'tenant_admin',
        'is_active' => true,
    ]);
    $this->tenant->update(['settings' => ['permissions' => [
        'Admin' => ['Precio' => 'none'],
    ]]]);

    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($admin)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 2.00])
        ->assertStatus(403);
});

test('an owner keeps both privileges even if the matrix says otherwise', function () {
    // The owner has no row in the matrix and cannot lock themselves out.
    $this->tenant->update(['settings' => ['permissions' => [
        'Admin' => ['Precio' => 'none', 'Eliminar' => 'none'],
    ]]]);

    $log = ($this->log)(['price_charged' => 10.00]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}", ['price_charged' => 2.00])
        ->assertOk();

    ($this->as)($this->owner)
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertOk();
});
