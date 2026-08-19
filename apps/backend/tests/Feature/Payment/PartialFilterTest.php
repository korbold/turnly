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

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $ledger = app(PaymentLedger::class);

    $mk = function (float $price, ?float $abona) use ($service, $resource, $ledger) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $price,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'log_date' => now()->toDateString(),
        ]);
        if ($abona !== null) {
            $ledger->recordForServiceLog($log, $abona, 'cash', null, $this->owner->id);
        }
        return $log->fresh();
    };

    $this->impago  = $mk(10.00, null);
    $this->abonado = $mk(30.00, 10.00);
    $this->pagado  = $mk(20.00, 20.00);

    $this->filtrar = fn (string $f) => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs?payment={$f}&date=" . now()->toDateString());
});

test('the partial filter shows only the ones with an abono', function () {
    $ids = collect(($this->filtrar)('partial')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->abonado->id]);
});

test('pending means something is still owed, abonos included', function () {
    // Que "Pendiente" esconda un servicio con $20 sin cobrar es exactamente
    // cómo se pierde un cobro.
    $ids = collect(($this->filtrar)('pending')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toHaveCount(2);
    expect($ids)->toContain($this->impago->id);
    expect($ids)->toContain($this->abonado->id);
});

test('paid still means paid', function () {
    $ids = collect(($this->filtrar)('paid')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->pagado->id]);
});
