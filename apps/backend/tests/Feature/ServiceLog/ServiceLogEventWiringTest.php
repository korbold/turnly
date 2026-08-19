<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogEventWiringTest.php

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

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 10.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->events = fn (string $logId) => ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $logId)
        ->orderBy('changed_at')
        ->pluck('event')
        ->all();

    $this->register = fn (array $extra = []) => ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('registering a service paid at the counter writes the sale and the payment', function () {
    // "Cobrar ahora" es un cobro igual que el diferido: la bitácora tiene que
    // decir con qué método entró la plata, no sólo que el servicio existe.
    $id = ($this->register)()->json('data.id');

    expect(($this->events)($id))->toBe([
        ServiceLogEventModel::EVENT_CREATED,
        ServiceLogEventModel::EVENT_PAYMENT_RECORDED,
    ]);

    $event = ServiceLogEventModel::withoutGlobalScopes()->where('service_log_id', $id)->first();
    expect($event->changed_by_user_id)->toBe($this->owner->id);

    $pago = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_PAYMENT_RECORDED)
        ->first();
    expect($pago->detail['method'])->toBe('cash');
    expect($pago->detail['amount'])->toEqual(10);
});

test('registering a service to be paid later writes no payment yet', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    expect(($this->events)($id))->toBe([ServiceLogEventModel::EVENT_CREATED]);
});

test('editing the payment method leaves a trail', function () {
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$id}", [
            'payment_method' => 'transfer',
            'payment_bank'   => 'pichincha',
        ])
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_LOG_UPDATED)
        ->first();

    $campos = array_column($event->detail['changes'], 'field');
    expect($campos)->toContain('payment_method')->toContain('payment_bank');

    $metodo = collect($event->detail['changes'])->firstWhere('field', 'payment_method');
    expect($metodo['from'])->toBe('cash');
    expect($metodo['to'])->toBe('transfer');
});

test('an edit that changes nothing writes no event', function () {
    // La bitácora registra cambios, no guardados. Reenviar el mismo método de
    // pago no es un hecho que valga la pena contarle a nadie.
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$id}", ['payment_method' => 'cash'])
        ->assertOk();

    expect(($this->events)($id))->not->toContain(ServiceLogEventModel::EVENT_LOG_UPDATED);
});

test('editing the items writes both totals', function () {
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 2, 'unit_price' => 10.00,
            ]],
        ])
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_ITEMS_CHANGED)
        ->first();

    // toEqual y no toBe: un 10.0 vuelve de JSON como int 10, y a la bitácora no
    // le importa el tipo de PHP.
    expect($event->detail)->toEqual(['total_before' => 10, 'total_after' => 20]);
});

test('recording a payment writes the method and the bank', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    ($this->as)($this->owner)
        ->postJson("/api/v1/service-logs/{$id}/payment", [
            'method' => 'transfer', 'bank' => 'pichincha',
        ])
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_PAYMENT_RECORDED)
        ->first();

    expect($event->detail['method'])->toBe('transfer');
    expect($event->detail['bank'])->toBe('pichincha');
    expect($event->detail['amount'])->toEqual(10);
});

test('completing writes the transition', function () {
    $id = ($this->register)([
        'washed_by' => $this->washer->id,
        'dried_by'  => $this->dryer->id,
    ])->json('data.id');

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$id}/complete")
        ->assertOk();

    $event = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', ServiceLogEventModel::EVENT_STATUS_CHANGED)
        ->first();

    expect($event->detail)->toBe(['from' => 'in_progress', 'to' => 'completed']);
});

test('a failed complete writes no event', function () {
    // Sin asignados el complete devuelve 422 (Task 7); la bitácora no debe
    // registrar una transición que no ocurrió.
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)->patchJson("/api/v1/service-logs/{$id}/complete");

    expect(($this->events)($id))->not->toContain(ServiceLogEventModel::EVENT_STATUS_CHANGED);
});

test('requesting an invoice writes the request', function () {
    $id = ($this->register)()->json('data.id');

    ($this->as)($this->owner)->postJson("/api/v1/service-logs/{$id}/invoice");

    expect(($this->events)($id))->toContain(ServiceLogEventModel::EVENT_INVOICE_REQUESTED);
});

test('deleting a log takes its trail with it', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'invoice_status' => null,
    ]);
    app(\App\Application\Services\ServiceLogEventRecorder::class)->created($log, $this->owner->id);

    ($this->as)($this->owner)->deleteJson("/api/v1/service-logs/{$log->id}")->assertOk();

    expect(ServiceLogEventModel::withoutGlobalScopes()->where('service_log_id', $log->id)->count())
        ->toBe(0);
});

test('an inactive staff member cannot be assigned at registration', function () {
    $inactive = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Renunció',
        'position'  => 'washer', 'is_active' => false,
    ]);

    ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'washed_by'          => $inactive->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['washed_by']);
});
