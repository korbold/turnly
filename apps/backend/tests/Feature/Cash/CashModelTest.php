<?php

use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->user = UserModel::factory()->create();

    $this->session = fn (array $attrs = []) => CashSessionModel::create(array_merge([
        'tenant_id'      => $this->tenant->id,
        'business_date'  => now()->toDateString(),
        'opened_by'      => $this->user->id,
        'opened_at'      => now(),
        'opening_amount' => 30.00,
        'status'         => CashSessionModel::STATUS_OPEN,
    ], $attrs));
});

test('a session records the base the owner handed over', function () {
    $s = ($this->session)();

    expect((float) $s->fresh()->opening_amount)->toBe(30.0);
    expect($s->status)->toBe('open');
    // El esperado no existe hasta el cierre: eso ES el cierre ciego.
    expect($s->expected_amount)->toBeNull();
});

test('a movement hangs off its session with a positive amount', function () {
    $s = ($this->session)();

    $m = CashMovementModel::create([
        'tenant_id'       => $this->tenant->id,
        'cash_session_id' => $s->id,
        'type'            => CashMovementModel::TYPE_EXPENSE,
        'amount'          => 4.50,
        'reason'          => 'Almuerzo',
        'created_by'      => $this->user->id,
    ]);

    expect((float) $m->fresh()->amount)->toBe(4.5);
    expect($s->fresh()->movements)->toHaveCount(1);
});

test('a tenant cannot have two sessions for the same business day', function () {
    // Una caja por día del negocio. Sin esto, abrir dos veces por la mañana
    // parte la recaudación en dos cajones que nadie cuadra.
    ($this->session)();

    expect(fn () => ($this->session)())
        ->toThrow(Illuminate\Database\QueryException::class);
});

test('the open scope only returns sessions still open', function () {
    ($this->session)(['business_date' => now()->subDay()->toDateString(), 'status' => CashSessionModel::STATUS_CLOSED]);
    $abierta = ($this->session)();

    expect(CashSessionModel::open()->pluck('id')->all())->toBe([$abierta->id]);
});

test('the tenant scope hides another tenants cash', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    CashSessionModel::create([
        'tenant_id' => $otro->id, 'business_date' => now()->toDateString(),
        'opened_by' => $this->user->id, 'opened_at' => now(),
        'opening_amount' => 99.00, 'status' => CashSessionModel::STATUS_OPEN,
    ]);
    ($this->session)();

    expect(CashSessionModel::count())->toBe(1);
    expect((float) CashSessionModel::first()->opening_amount)->toBe(30.0);
});

test('a payment can point at the session it was collected in', function () {
    expect(Schema::hasColumn('payments', 'cash_session_id'))->toBeTrue();
});
