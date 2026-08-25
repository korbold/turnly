<?php
// apps/backend/tests/Feature/Cash/CashHistoryTest.php
//
// El historial de caja.
//
// Todo lo que se registra —quién abrió, quién movió plata, quién contó, quién
// reabrió y por qué, cuánto cobró cada persona— existía en la base y no se
// podía mirar desde ninguna pantalla. La única forma de leer el arqueo del 24
// de agosto fue con SQL contra producción.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Application\Services\PaymentLedger;
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

    $this->member = function (string $role, string $name) {
        $user = UserModel::factory()->create(['name' => $name]);
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner   = ($this->member)('owner', 'Federman');
    $this->vanessa = ($this->member)('cashier', 'Vanessa');
    $this->lavador = ($this->member)('washer', 'Luis');

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $service  = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->cobra = function (UserModel $quien, float $monto) use ($service, $resource) {
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
        return app(PaymentLedger::class)->recordForServiceLog($log, $monto, 'cash', null, $quien->id);
    };

    // Una caja de un día cualquiera, abierta y cerrada.
    $this->cajaDe = function (string $fecha, float $base, float $contado) {
        $id = ($this->as)($this->vanessa)
            ->postJson('/api/v1/cash-sessions', ['opening_amount' => $base, 'business_date' => $fecha])
            ->json('data.id');

        ($this->as)($this->vanessa)
            ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => $contado]);

        return $id;
    };
});

test('the history lists the tills that were closed', function () {
    ($this->cajaDe)('2026-08-20', 30.00, 200.00);
    ($this->cajaDe)('2026-08-21', 40.00, 464.00);

    $r = ($this->as)($this->owner)->getJson('/api/v1/cash-sessions')->assertOk();

    expect($r->json('data'))->toHaveCount(2);
});

test('the newest till comes first', function () {
    ($this->cajaDe)('2026-08-20', 30.00, 200.00);
    ($this->cajaDe)('2026-08-21', 40.00, 464.00);

    $r = ($this->as)($this->owner)->getJson('/api/v1/cash-sessions');

    expect($r->json('data.0.business_date'))->toBe('2026-08-21');
});

test('each row carries what the day cost: base, counted, expected, difference', function () {
    ($this->cajaDe)('2026-08-21', 40.00, 464.00);

    $fila = ($this->as)($this->owner)->getJson('/api/v1/cash-sessions')->json('data.0');

    expect((float) $fila['opening_amount'])->toBe(40.0);
    expect((float) $fila['counted_amount'])->toBe(464.0);
    expect((float) $fila['expected_amount'])->toBe(40.0);
    expect((float) $fila['difference'])->toBe(424.0);
    expect($fila['opened_by']['name'])->toBe('Vanessa');
});

test('a till still open shows no expected amount in the history', function () {
    // El historial no puede ser la ventana por donde se lee el esperado del
    // día en curso: eso es el conteo ciego, y da igual desde qué pantalla se
    // mire.
    ($this->as)($this->vanessa)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => 40.00]);
    ($this->cobra)($this->vanessa, 100.00);

    $fila = ($this->as)($this->vanessa)->getJson('/api/v1/cash-sessions')->json('data.0');

    expect($fila['status'])->toBe('open');
    expect($fila['expected_amount'])->toBeNull();
    expect($fila['cash_by_person'])->toBeNull();
});

test('a washer cannot read the cash history', function () {
    ($this->cajaDe)('2026-08-21', 40.00, 464.00);

    ($this->as)($this->lavador)->getJson('/api/v1/cash-sessions')->assertStatus(403);
});

test('the detail of a till carries its movements and who collected what', function () {
    $id = ($this->as)($this->vanessa)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => 40.00])
        ->json('data.id');

    ($this->as)($this->vanessa)->postJson("/api/v1/cash-sessions/{$id}/movements", [
        'type' => 'deposit', 'amount' => 10.00, 'reason' => 'Aumento de caja',
    ]);
    ($this->cobra)($this->owner, 75.00);
    ($this->cobra)($this->vanessa, 434.00);

    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 464.00]);

    $d = ($this->as)($this->owner)->getJson("/api/v1/cash-sessions/{$id}")->assertOk()->json('data');

    expect($d['movements'])->toHaveCount(1);
    expect($d['movements'][0]['reason'])->toBe('Aumento de caja');
    expect(collect($d['cash_by_person'])->pluck('amount', 'name')->all())
        ->toEqual(['Vanessa' => 434.0, 'Federman' => 75.0]);
});

test('the detail keeps every count, including the ones that were undone', function () {
    // Los dos arqueos del mismo día: el que se firmó y el que lo corrigió,
    // con el motivo de la reapertura entre medio. Es la historia de la caja.
    $id = ($this->cajaDe)('2026-08-21', 40.00, 464.00);

    ($this->as)($this->owner)->postJson("/api/v1/cash-sessions/{$id}/reopen", [
        'reason' => 'Faltaba cobrar 8 servicios',
    ]);
    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 514.00]);

    $cierres = ($this->as)($this->owner)->getJson("/api/v1/cash-sessions/{$id}")->json('data.closures');

    expect($cierres)->toHaveCount(2);
    expect((float) $cierres[0]['counted_amount'])->toBe(464.0);
    expect($cierres[0]['reopen_reason'])->toBe('Faltaba cobrar 8 servicios');
    expect($cierres[0]['reopened_by']['name'])->toBe('Federman');
    expect((float) $cierres[1]['counted_amount'])->toBe(514.0);
    expect($cierres[1]['reopen_reason'])->toBeNull();
});

test('the detail of another tenant is a 404', function () {
    $id = ($this->cajaDe)('2026-08-21', 40.00, 464.00);

    $otro = TenantModel::factory()->create(['status' => 'active']);
    $ajeno = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $ajeno->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->actingAs($ajeno)->withHeader('X-Tenant', $otro->slug)
        ->getJson("/api/v1/cash-sessions/{$id}")
        ->assertStatus(404);
});
