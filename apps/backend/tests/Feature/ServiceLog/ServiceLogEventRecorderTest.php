<?php

use App\Application\Services\ServiceLogEventRecorder;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'car_wash',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);
    $this->log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
    ]);

    $this->recorder = app(ServiceLogEventRecorder::class);
});

test('created writes one event stamped with the tenant and the actor', function () {
    $this->recorder->created($this->log, $this->user->id);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_CREATED);
    expect($event->service_log_id)->toBe($this->log->id);
    expect($event->tenant_id)->toBe($this->tenant->id);
    expect($event->changed_by_user_id)->toBe($this->user->id);
    expect($event->changed_at)->not->toBeNull();
});

test('assigneeChanged denormalizes both names so a rename cannot rewrite history', function () {
    $from = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Jorge Tián', 'position' => 'washer',
    ]);
    $to = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman Paspuel', 'position' => 'washer',
    ]);

    $this->recorder->assigneeChanged($this->log, 'washer', $from, $to, $this->user->id);

    // El catálogo se renombra después del hecho.
    $to->update(['name' => 'OTRO NOMBRE']);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED);
    expect($event->detail['position'])->toBe('washer');
    expect($event->detail['from_name'])->toBe('Jorge Tián');
    expect($event->detail['to_name'])->toBe('Federman Paspuel');
    expect($event->detail['from_id'])->toBe($from->id);
    expect($event->detail['to_id'])->toBe($to->id);
});

test('assigneeChanged handles an assignment from nobody', function () {
    $to = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);

    $this->recorder->assigneeChanged($this->log, 'dryer', null, $to, $this->user->id);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->detail['from_id'])->toBeNull();
    expect($event->detail['from_name'])->toBeNull();
    expect($event->detail['to_name'])->toBe('Federman');
});

test('paymentRecorded keeps the method, the bank and the amount', function () {
    $this->recorder->paymentRecorded($this->log, 'transfer', 'pichincha', 12.50, $this->user->id);

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_PAYMENT_RECORDED);
    expect($event->detail)->toBe(['method' => 'transfer', 'bank' => 'pichincha', 'amount' => 12.5]);
});

test('itemsChanged keeps both totals', function () {
    $this->recorder->itemsChanged($this->log, 12.00, 18.00, $this->user->id);

    // toEqual y no toBe: 12.0 vuelve de JSON como int 12, y a la bitácora no le
    // importa el tipo de PHP — su afirmación es "el total pasó de 12 a 18".
    expect(ServiceLogEventModel::withoutGlobalScopes()->first()->detail)
        ->toEqual(['total_before' => 12, 'total_after' => 18]);
});

test('statusChanged keeps the transition', function () {
    $this->recorder->statusChanged($this->log, 'in_progress', 'completed', $this->user->id);

    expect(ServiceLogEventModel::withoutGlobalScopes()->first()->detail)
        ->toBe(['from' => 'in_progress', 'to' => 'completed']);
});

test('invoiceStatusChanged has no actor because the SRI is not a person', function () {
    $this->recorder->invoiceStatusChanged($this->log, 'enviada', 'rechazada', 'ESTABLECIMIENTO CERRADO');

    $event = ServiceLogEventModel::withoutGlobalScopes()->first();

    expect($event->event)->toBe(ServiceLogEventModel::EVENT_INVOICE_STATUS_CHANGED);
    expect($event->changed_by_user_id)->toBeNull();
    expect($event->detail['to'])->toBe('rechazada');
    expect($event->detail['reason'])->toBe('ESTABLECIMIENTO CERRADO');
});

test('the log is append-only: the model carries no updated_at', function () {
    $this->recorder->created($this->log, $this->user->id);

    expect(ServiceLogEventModel::withoutGlobalScopes()->first()->timestamps)->toBeFalse();
    expect(ServiceLogEventModel::UPDATED_AT)->toBeNull();
});
