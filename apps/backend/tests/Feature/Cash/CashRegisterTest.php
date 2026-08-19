<?php

use App\Application\Services\CashRegister;
use App\Application\Services\PaymentLedger;
use App\Domain\Cash\CashRegisterException;
use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => now()->toDateString(),
    ]);

    $this->caja   = app(CashRegister::class);
    $this->ledger = app(PaymentLedger::class);
    $this->hoy    = now()->toDateString();

    $this->abrir = fn (float $base = 30.00, ?string $date = null) =>
        $this->caja->openSession($this->tenant->id, $date ?? $this->hoy, $base, $this->user->id);
});

test('opening a session records the base and leaves it open', function () {
    $s = ($this->abrir)(30.00);

    expect($s->status)->toBe('open');
    expect((float) $s->opening_amount)->toBe(30.0);
    expect($this->caja->currentSession($this->tenant->id)->id)->toBe($s->id);
});

test('a second session for the same day is refused', function () {
    ($this->abrir)();

    expect(fn () => ($this->abrir)())
        ->toThrow(CashRegisterException::class);
});

test('yesterdays open session blocks today and names its date', function () {
    // "La caja de ayer no se cierra sola: nadie contó esa plata a medianoche."
    $ayer = now()->subDay()->toDateString();
    ($this->abrir)(30.00, $ayer);

    try {
        ($this->abrir)(30.00, $this->hoy);
        $this->fail('esperaba CashRegisterException');
    } catch (CashRegisterException $e) {
        expect($e->errorCode)->toBe('PREVIOUS_SESSION_OPEN');
        expect($e->getMessage())->toContain($ayer);
    }
});

test('the expected amount is base plus cash collected in the session', function () {
    $s = ($this->abrir)(30.00);
    $this->ledger->recordForServiceLog(($this->log)(15.00), 15.00, 'cash', null, $this->user->id);

    expect($this->caja->expectedFor($s->fresh()))->toBe(45.0);
});

test('card and transfer never touch the drawer', function () {
    $s = ($this->abrir)(30.00);
    $this->ledger->recordForServiceLog(($this->log)(50.00), 50.00, 'card', null, $this->user->id);
    $this->ledger->recordForServiceLog(($this->log)(20.00), 20.00, 'transfer', 'pichincha', $this->user->id);

    expect($this->caja->expectedFor($s->fresh()))->toBe(30.0);
});

test('movements move the expected amount in the direction their type says', function () {
    $s = ($this->abrir)(100.00);

    $this->caja->addMovement($s, CashMovementModel::TYPE_EXPENSE, 10.00, 'Almuerzo', $this->user->id);
    $this->caja->addMovement($s, CashMovementModel::TYPE_WITHDRAWAL, 40.00, 'Retiro del dueño', $this->user->id);
    $this->caja->addMovement($s, CashMovementModel::TYPE_DEPOSIT, 5.00, 'Cambio', $this->user->id);

    // 100 − 10 − 40 + 5
    expect($this->caja->expectedFor($s->fresh()))->toBe(55.0);
});

test('an unknown movement type is refused', function () {
    $s = ($this->abrir)();

    expect(fn () => $this->caja->addMovement($s, 'propina', 5.00, 'x', $this->user->id))
        ->toThrow(CashRegisterException::class);
});

test('closing freezes counted, expected and the difference', function () {
    $s = ($this->abrir)(30.00);
    $this->ledger->recordForServiceLog(($this->log)(20.00), 20.00, 'cash', null, $this->user->id);

    $cerrada = $this->caja->closeSession($s->fresh(), 48.00, $this->user->id, 'faltó un billete');

    expect($cerrada->status)->toBe('closed');
    expect((float) $cerrada->counted_amount)->toBe(48.0);
    expect((float) $cerrada->expected_amount)->toBe(50.0);
    expect((float) $cerrada->difference)->toBe(-2.0);
    expect($cerrada->closed_by)->toBe($this->user->id);
    expect($cerrada->closed_at)->not->toBeNull();
});

test('a surplus is a positive difference', function () {
    $s = ($this->abrir)(30.00);

    $cerrada = $this->caja->closeSession($s, 33.00, $this->user->id);

    expect((float) $cerrada->difference)->toBe(3.0);
});

test('a closed session cannot be closed again', function () {
    // "Cerrada no se reabre": tampoco se re-cierra con otro conteo.
    $s = ($this->abrir)();
    $this->caja->closeSession($s, 30.00, $this->user->id);

    expect(fn () => $this->caja->closeSession($s->fresh(), 99.00, $this->user->id))
        ->toThrow(CashRegisterException::class);
});

test('a closed session takes no more movements', function () {
    $s = ($this->abrir)();
    $this->caja->closeSession($s, 30.00, $this->user->id);

    expect(fn () => $this->caja->addMovement($s->fresh(), CashMovementModel::TYPE_EXPENSE, 1.00, 'x', $this->user->id))
        ->toThrow(CashRegisterException::class);
});

test('cash collected with no session open is reported, not swallowed', function () {
    // La caja no bloquea el mostrador, pero el efectivo huérfano tiene que
    // ser visible o la pantalla miente por omisión.
    $this->ledger->recordForServiceLog(($this->log)(12.00), 12.00, 'cash', null, $this->user->id);

    expect($this->caja->cashCollectedWithoutSession($this->tenant->id, $this->hoy))->toBe(12.0);
});

test('cash collected inside a session is not counted as orphan', function () {
    ($this->abrir)();
    $this->ledger->recordForServiceLog(($this->log)(12.00), 12.00, 'cash', null, $this->user->id);

    expect($this->caja->cashCollectedWithoutSession($this->tenant->id, $this->hoy))->toBe(0.0);
});
