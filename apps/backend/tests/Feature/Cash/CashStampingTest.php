<?php

use App\Application\Services\CashRegister;
use App\Application\Services\PaymentLedger;
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

    $this->log = fn (float $price = 10.00) => ServiceLogModel::factory()->create([
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
});

test('a payment made with a session open belongs to it', function () {
    $s = $this->caja->openSession($this->tenant->id, now()->toDateString(), 20.00, $this->user->id);

    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'cash', null, $this->user->id);

    expect($p->cash_session_id)->toBe($s->id);
});

test('a payment made with no session open belongs to none', function () {
    // La caja no bloquea el mostrador.
    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'cash', null, $this->user->id);

    expect($p->cash_session_id)->toBeNull();
});

test('a card payment still gets stamped, so the session knows what it did not hold', function () {
    // Se estampa igual aunque no sea efectivo: la sesión es el contexto del
    // cobro, no sólo el cajón. `expectedFor` ya filtra por method = cash.
    $s = $this->caja->openSession($this->tenant->id, now()->toDateString(), 0.00, $this->user->id);

    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'card', null, $this->user->id);

    expect($p->cash_session_id)->toBe($s->id);
    expect($this->caja->expectedFor($s->fresh()))->toBe(0.0);
});

test('a payment does not fall into yesterdays still-open session by accident', function () {
    // Si la caja de ayer quedó abierta, el cobro de hoy cae ahí — y está
    // bien: es la única caja abierta, y por eso el sistema exige cerrarla
    // antes de abrir la de hoy. Este test fija ese comportamiento para que
    // nadie lo "arregle" silenciosamente.
    $ayer = $this->caja->openSession(
        $this->tenant->id, now()->subDay()->toDateString(), 0.00, $this->user->id
    );

    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'cash', null, $this->user->id);

    expect($p->cash_session_id)->toBe($ayer->id);
});
