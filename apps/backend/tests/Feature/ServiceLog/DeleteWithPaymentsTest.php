<?php
// apps/backend/tests/Feature/ServiceLog/DeleteWithPaymentsTest.php
//
// Eliminar un registro dejaba su pago huérfano: el `service_log` se borra
// físicamente y el pago quedaba apuntando a nada, sumando en la caja del día.
// Pasó en producción con un ticket de ejemplo cobrado a medias ($5 de $10): el
// cajón siguió esperando esos $5 que nunca entraron.
//
// El candado que ya existía miraba sólo `paid`, así que un `partial` se colaba.

use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 10]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->session = fn (string $status) => CashSessionModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'business_date' => now()->toDateString(), 'opened_by' => $this->owner->id,
        'opened_at' => now(), 'opening_amount' => 40, 'status' => $status,
    ]);

    // Un ticket de $10 con un abono de $5: el caso exacto de producción.
    $this->ticketAbonado = function (?CashSessionModel $session) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => 10,
            'payment_status' => 'partial',
            'status' => 'in_progress',
        ]);

        $pago = PaymentModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'amount' => 5, 'method' => 'cash', 'paid_at' => now(),
            'received_by' => $this->owner->id,
            'cash_session_id' => $session?->id,
        ]);
        PaymentAllocationModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'payment_id' => $pago->id, 'payable_type' => 'service_log',
            'payable_id' => $log->id, 'amount' => 5,
        ]);

        return [$log, $pago];
    };

    $this->as = fn () => $this->actingAs($this->owner)->withHeader('X-Tenant', $this->tenant->slug);
});

test('deleting a partially paid ticket takes its payment with it', function () {
    [$log, $pago] = ($this->ticketAbonado)(($this->session)('open'));

    ($this->as)()
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertOk();

    expect(ServiceLogModel::withoutGlobalScopes()->find($log->id))->toBeNull();
    // Lo que importa: el pago no sobrevive al registro. Un pago huérfano sigue
    // sumando en la caja y el arqueo pide plata que nunca entró.
    expect(PaymentModel::withoutGlobalScopes()->find($pago->id))->toBeNull();
    expect(PaymentAllocationModel::withoutGlobalScopes()->where('payment_id', $pago->id)->count())->toBe(0);
});

test('a ticket whose payment landed in a closed caja cannot be deleted', function () {
    // Ese conteo ya se firmó: borrar el pago ahora reescribiría un arqueo
    // cerrado, y el número que el dueño comparó contra billetes dejaría de
    // cuadrar sin que nadie lo haya tocado.
    [$log, $pago] = ($this->ticketAbonado)(($this->session)('closed'));

    ($this->as)()
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_LOCKED');

    expect(ServiceLogModel::withoutGlobalScopes()->find($log->id))->not->toBeNull();
    expect(PaymentModel::withoutGlobalScopes()->find($pago->id))->not->toBeNull();
});

test('a fully paid ticket is still untouchable', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 10,
        'payment_status' => 'paid',
        'status' => 'completed',
    ]);

    ($this->as)()
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'LOG_LOCKED');
});

test('an unpaid ticket still deletes, and leaves no payment behind', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 10,
        'payment_status' => 'unpaid',
        'status' => 'in_progress',
    ]);

    ($this->as)()
        ->deleteJson("/api/v1/service-logs/{$log->id}")
        ->assertOk();

    expect(ServiceLogModel::withoutGlobalScopes()->find($log->id))->toBeNull();
});
