<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogPaidItemsLockTest.php
//
// El dueño de FEDER: después de cobrar, el cajero podía entrar al registro y
// cambiar los servicios — quitar uno, bajarle el precio, cambiarlo por otro.
// Con plata ya cobrada, eso es reescribir lo que se cobró. Desde el primer
// cobro el cajero solo puede agregar; corregir lo cobrado es del dueño o el
// administrador.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
        'settings' => ['require_staff_on_complete' => false],
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

    $this->lavado   = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 6.00]);
    $this->aspirado = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 3.00]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->line = fn (ServiceModel $s, int $qty = 1, ?float $price = null) => [
        'service_id' => $s->id, 'label' => $s->name, 'qty' => $qty,
        'unit_price' => $price ?? (float) $s->price,
    ];

    // Lavado + aspirado, en progreso. Cobrado entero salvo que se pida otra cosa.
    $this->log = function (string $payment = 'paid') {
        $body = [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [($this->line)($this->lavado), ($this->line)($this->aspirado)],
        ];
        $body += $payment === 'paid'
            ? ['payment_method' => 'card']
            : ['payment_status' => 'unpaid'];

        $id = ($this->as)($this->owner)->postJson('/api/v1/service-logs', $body)
            ->assertStatus(201)->json('data.id');

        if ($payment === 'partial') {
            ($this->as)($this->owner)
                ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'card', 'amount' => 4])
                ->assertSuccessful();
        }

        return $id;
    };

    $this->putItems = fn (string $id, array $items, ?UserModel $who = null) => ($this->as)($who ?? $this->cashier)
        ->putJson("/api/v1/service-logs/{$id}/items", ['items' => $items]);
});

test('a cashier cannot remove a service from a paid log', function () {
    $id = ($this->log)();

    ($this->putItems)($id, [($this->line)($this->lavado)])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');

    expect((float) ServiceLogModel::find($id)->price_charged)->toBe(9.0);
});

test('a cashier cannot lower the price of a paid service', function () {
    $id = ($this->log)();

    ($this->putItems)($id, [($this->line)($this->lavado, 1, 4.00), ($this->line)($this->aspirado)])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');
});

test('a cashier cannot lower the quantity of a paid service', function () {
    $id = ($this->log)();
    ($this->putItems)($id, [($this->line)($this->lavado, 2), ($this->line)($this->aspirado)])->assertOk();

    ($this->putItems)($id, [($this->line)($this->lavado, 1), ($this->line)($this->aspirado)])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');
});

test('a cashier cannot swap a paid service for another', function () {
    $id = ($this->log)();
    $otro = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 6.00]);

    ($this->putItems)($id, [($this->line)($otro), ($this->line)($this->aspirado)])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');
});

test('a cashier can still add a service to a paid log', function () {
    $id = ($this->log)();
    $extra = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 2.00]);

    ($this->putItems)($id, [
        ($this->line)($this->lavado), ($this->line)($this->aspirado), ($this->line)($extra),
    ])->assertOk()->assertJsonPath('data.payment_status', 'partial');

    expect((float) ServiceLogModel::find($id)->price_charged)->toBe(11.0);
});

test('a partially paid log is locked for the cashier too', function () {
    $id = ($this->log)('partial');

    ($this->putItems)($id, [($this->line)($this->lavado)])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');
});

test('a cashier edits an unpaid log freely', function () {
    $id = ($this->log)('unpaid');

    ($this->putItems)($id, [($this->line)($this->lavado)])->assertOk();
});

test('the owner and the admin can correct a paid log', function () {
    $id = ($this->log)();
    ($this->putItems)($id, [($this->line)($this->lavado, 1, 5.00), ($this->line)($this->aspirado)], $this->admin)
        ->assertOk();

    ($this->putItems)($id, [($this->line)($this->lavado, 1, 5.00)], $this->owner)->assertOk();

    expect((float) ServiceLogModel::find($id)->price_charged)->toBe(5.0);
});

test('a cashier cannot rewrite the total or the service of a paid log through the row editor', function () {
    $id = ($this->log)();

    ($this->as)($this->cashier)->patchJson("/api/v1/service-logs/{$id}", ['price_charged' => 1])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');

    ($this->as)($this->cashier)->patchJson("/api/v1/service-logs/{$id}", ['service_id' => $this->aspirado->id])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'PAID_ITEMS_LOCKED');

    // Las notas siguen siendo del cajero.
    ($this->as)($this->cashier)->patchJson("/api/v1/service-logs/{$id}", ['notes' => 'Cliente frecuente'])
        ->assertOk();
});
