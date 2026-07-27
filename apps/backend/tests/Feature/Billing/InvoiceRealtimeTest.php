<?php

use App\Events\InvoiceStatusUpdated;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Jobs\EmitReservationInvoiceJob;
use App\Infrastructure\Jobs\SyncReservationInvoiceStatusJob;
use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;
use App\Infrastructure\Notifications\Notifications\InvoiceRejected;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Mail::fake();
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user   = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

function realtimeReservation($self): ReservationModel
{
    return ReservationModel::factory()->create([
        'tenant_id'           => $self->tenant->id,
        'client_id'           => $self->user->id,
        'client_resource_id'  => $self->clientResource->id,
        'service_id'          => $self->service->id,
        'created_by'          => $self->user->id,
        'payment_method'      => 'cash',
        'status'              => 'completed',
        'invoice_external_id' => 'res-ext-1',
        'invoice_status'      => 'enviada',
    ]);
}

test('InvoiceStatusUpdated broadcasts on the tenant channel with the invoice payload', function () {
    $event = new InvoiceStatusUpdated(
        tenantId: 'tenant-1',
        referenceType: 'reservation',
        referenceId: 'res-1',
        invoiceExternalId: 'inv-ext-1',
        status: 'autorizada',
        numeroAutorizacion: 'AUTH-123',
        claveAcceso: str_repeat('9', 49),
    );

    expect($event->broadcastAs())->toBe('invoice.status.updated');

    $channels = $event->broadcastOn();
    expect($channels)->toHaveCount(1)
        ->and($channels[0])->toBeInstanceOf(PrivateChannel::class)
        ->and($channels[0]->name)->toBe('private-tenant.tenant-1');

    expect($event->broadcastWith())->toBe([
        'referenceType'      => 'reservation',
        'referenceId'        => 'res-1',
        'invoiceExternalId'  => 'inv-ext-1',
        'status'             => 'autorizada',
        'numeroAutorizacion' => 'AUTH-123',
        'claveAcceso'        => str_repeat('9', 49),
    ]);
});

test('emit job broadcasts InvoiceStatusUpdated after writing status', function () {
    Event::fake([InvoiceStatusUpdated::class]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'status'             => 'completed',
    ]);

    Http::fake(['*/api/invoices' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'enviada', 'clave_acceso' => str_repeat('1', 49)],
    ], 201)]);

    (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient());

    Event::assertDispatched(InvoiceStatusUpdated::class, fn ($e) =>
        $e->referenceType === 'reservation'
        && $e->referenceId === (string) $reservation->id
        && $e->status === 'enviada');
});

test('sync job broadcasts InvoiceStatusUpdated on autorizada', function () {
    Event::fake([InvoiceStatusUpdated::class]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'autorizada', 'numero_autorizacion' => 'AUTH-9'],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Event::assertDispatched(InvoiceStatusUpdated::class, fn ($e) =>
        $e->referenceId === (string) $reservation->id && $e->status === 'autorizada');
});

test('sync job broadcasts InvoiceStatusUpdated on rechazada', function () {
    Event::fake([InvoiceStatusUpdated::class]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'rechazada', 'mensajes' => [['mensaje' => 'RUC inválido']]],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Event::assertDispatched(InvoiceStatusUpdated::class, fn ($e) =>
        $e->referenceId === (string) $reservation->id && $e->status === 'rechazada');
});

test('sync job notifies tenant admins on autorizada', function () {
    Notification::fake();
    $admin = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $admin->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'autorizada', 'numero_autorizacion' => 'AUTH-9'],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Notification::assertSentTo($admin, InvoiceAuthorized::class);
});

test('sync job notifies tenant admins on rechazada', function () {
    Notification::fake();
    $admin = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $admin->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'rechazada', 'mensajes' => [['mensaje' => 'RUC inválido']]],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Notification::assertSentTo($admin, InvoiceRejected::class);
});
