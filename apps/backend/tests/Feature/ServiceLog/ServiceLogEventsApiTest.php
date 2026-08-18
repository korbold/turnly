<?php
// apps/backend/tests/Feature/ServiceLog/ServiceLogEventsApiTest.php

use App\Application\Services\ServiceLogEventRecorder;
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
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create(['name' => 'Danny Barahona']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
    ]);
});

test('the detail returns the trail oldest first, with the actor name', function () {
    $recorder = app(ServiceLogEventRecorder::class);
    $recorder->created($this->log, $this->owner->id);
    $recorder->paymentRecorded($this->log, 'cash', null, 12.00, $this->owner->id);
    $recorder->invoiceStatusChanged($this->log, 'enviada', 'autorizada');

    $response = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs/{$this->log->id}")
        ->assertOk();

    // El recurso SÍ envuelve en `data` (no hay withoutWrapping en este
    // backend; el ServiceLogTest pre-existente asserta `data.id`).
    expect($response->json('data.events.*.event'))->toBe([
        'created', 'payment_recorded', 'invoice_status_changed',
    ]);
    expect($response->json('data.events.0.changed_by.name'))->toBe('Danny Barahona');

    // La clave tiene que existir y ser null — un path ausente también
    // devuelve null y la aserción pasaría sin probar nada.
    $events = $response->json('data.events');
    expect($events[2])->toHaveKey('changed_by');
    expect($events[2]['changed_by'])->toBeNull();
    expect($response->json('data.events.1.detail.amount'))->toBe(12);
});

test('the list endpoint does not carry the trail', function () {
    app(ServiceLogEventRecorder::class)->created($this->log, $this->owner->id);

    $row = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/service-logs')
        ->assertOk()
        ->json('data.0');

    expect($row)->not->toHaveKey('events');
});
