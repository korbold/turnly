<?php

use App\Application\Services\DebtLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    // business_type distinto de car_wash: completar no exige lavador ni
    // secador, que es otra feature y no la que se prueba acá.
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'barbershop',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = fn () => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 20.00,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'status' => 'in_progress',
        'log_date' => now()->toDateString(),
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->debts = app(DebtLedger::class);
});

test('completing with left_owing turns the balance into debt', function () {
    $log = ($this->log)();

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true])
        ->assertOk();

    expect($log->fresh()->left_owing)->toBeTrue();
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(20.0);
});

test('completing without the flag leaves it a pending of the day', function () {
    // El default importa: la app móvil completa sin conocer el campo, y eso
    // no puede convertir cada olvido en un deudor.
    $log = ($this->log)();

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->left_owing)->toBeFalse();
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('a paid service cannot be marked as leaving owing', function () {
    // No hay saldo que deber. Marcarlo sería un deudor de cero.
    $log = ($this->log)();
    ($this->as)()->postJson("/api/v1/service-logs/{$log->id}/payment", ['method' => 'cash']);

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true])
        ->assertOk();

    expect($log->fresh()->left_owing)->toBeFalse();
});

test('the trail records that it left owing, and for how much', function () {
    $log = ($this->log)();

    ($this->as)()->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true]);

    $evento = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', 'left_owing')
        ->first();

    expect($evento)->not->toBeNull();
    expect((float) $evento->detail['amount'])->toBe(20.0);
});

test('the resource exposes the mark so the row can shout it', function () {
    $log = ($this->log)();
    ($this->as)()->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true]);

    ($this->as)()
        ->getJson("/api/v1/service-logs/{$log->id}")
        ->assertOk()
        ->assertJsonPath('data.left_owing', true);
});
