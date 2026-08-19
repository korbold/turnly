<?php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
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
    $this->washer  = ($this->member)('washer');

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->hoy = now()->toDateString();

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $this->cobrarEfectivo = function (float $monto) use ($service, $resource) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $monto,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'log_date' => now()->toDateString(),
        ]);
        app(PaymentLedger::class)->recordForServiceLog($log, $monto, 'cash', null, $this->owner->id);
    };

    $this->abrir = fn (float $base = 30.00) => ($this->as)($this->cashier)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => $base]);
});

test('with no session open the endpoint says so without inventing one', function () {
    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data', null)
        ->assertJsonPath('meta.cash_without_session', 0);
});

test('cash collected before opening shows up as an orphan, and does not block', function () {
    ($this->cobrarEfectivo)(12.00);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data', null)
        ->assertJsonPath('meta.cash_without_session', 12);
});

test('a cashier opens the drawer with a base', function () {
    ($this->abrir)(30.00)
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.opening_amount', 30)
        ->assertJsonPath('data.business_date', $this->hoy)
        ->assertJsonPath('data.opened_by.id', $this->cashier->id);
});

test('an open drawer never reveals what the system expects', function () {
    // El cierre ciego, en la capa que importa: la que el navegador ve.
    ($this->abrir)(30.00);
    ($this->cobrarEfectivo)(25.00);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data.expected_amount', null)
        ->assertJsonPath('data.difference', null);
});

test('opening twice in a day is refused with a reason', function () {
    ($this->abrir)();

    ($this->abrir)()
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_OPEN');
});

test('a washer may not touch the drawer', function () {
    ($this->as)($this->washer)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => 30])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'FORBIDDEN');
});

test('a movement lands in the session and comes back with it', function () {
    $id = ($this->abrir)()->json('data.id');

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/movements", [
            'type' => 'expense', 'amount' => 4.50, 'reason' => 'Almuerzo',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.type', 'expense')
        ->assertJsonPath('data.amount', 4.5);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data.movements.0.reason', 'Almuerzo');
});

test('a movement needs a reason', function () {
    // Un egreso sin motivo es un faltante con otro nombre.
    $id = ($this->abrir)()->json('data.id');

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/movements", ['type' => 'expense', 'amount' => 4.50])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);
});

test('closing reveals the three numbers at once', function () {
    $id = ($this->abrir)(30.00)->json('data.id');
    ($this->cobrarEfectivo)(20.00);

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 48.00])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.counted_amount', 48)
        ->assertJsonPath('data.expected_amount', 50)
        ->assertJsonPath('data.difference', -2)
        ->assertJsonPath('data.closed_by.id', $this->cashier->id);
});

test('a closed drawer is not reopened', function () {
    $id = ($this->abrir)()->json('data.id');
    ($this->as)($this->cashier)->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 30]);

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 99])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'SESSION_CLOSED');
});

test('a closed day can still be read', function () {
    $id = ($this->abrir)(30.00)->json('data.id');
    ($this->as)($this->cashier)->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 31]);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session?date=' . $this->hoy)
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.difference', 1);
});

test('another tenants drawer is not reachable by id', function () {
    $id = ($this->abrir)()->json('data.id');

    $otro = TenantModel::factory()->create(['status' => 'active']);
    $intruso = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $intruso->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->actingAs($intruso)->withHeader('X-Tenant', $otro->slug)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 1])
        ->assertStatus(404);
});
