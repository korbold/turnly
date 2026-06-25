<?php

use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Jobs\EmitReservationInvoiceJob;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

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

// ─── Job tests ────────────────────────────────────────────────────────────────

test('job updates invoice_status to autorizada on success', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'status'             => 'completed',
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => [
                'id'                  => 'res-uuid-001',
                'estado'              => 'autorizada',
                'clave_acceso'        => str_repeat('1', 49),
                'numero_autorizacion' => '2026062412345678',
            ],
        ], 201),
    ]);

    (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient());

    $reservation->refresh();
    expect($reservation->invoice_external_id)->toBe('res-uuid-001')
        ->and($reservation->invoice_status)->toBe('autorizada')
        ->and($reservation->invoice_clave_acceso)->toBe(str_repeat('1', 49))
        ->and($reservation->invoiced)->toBeTrue()
        ->and($reservation->invoiced_at)->not->toBeNull();
});

test('job sets invoice_status to rechazada and re-throws on billing error', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'status'             => 'completed',
    ]);

    Http::fake([
        '*/api/invoices' => Http::response(['error' => 'SRI timeout'], 500),
    ]);

    expect(fn () => (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient()))
        ->toThrow(RuntimeException::class);

    $reservation->refresh();
    expect($reservation->invoice_status)->toBe('rechazada')
        ->and($reservation->invoice_error)->not->toBeNull()
        ->and($reservation->invoiced)->toBeFalsy();
});

test('job uses consumidor final when billing_snapshot is null', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'card',
        'status'             => 'completed',
        'billing_snapshot'   => null,
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => ['id' => 'res-uuid-002', 'estado' => 'enviada', 'clave_acceso' => null, 'numero_autorizacion' => null],
        ], 201),
    ]);

    (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient());

    Http::assertSent(function ($request) {
        $body = $request->data();
        return $body['identificacion_comprador'] === '9999999999999'
            && $body['razon_social_comprador']   === 'CONSUMIDOR FINAL'
            && $body['tipo_identificacion_comprador'] === '07';
    });
});

test('job uses consumidor final when billing_snapshot doc_type is final_consumer', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'status'             => 'completed',
        'billing_snapshot'   => ['doc_type' => 'final_consumer'],
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => ['id' => 'res-uuid-003', 'estado' => 'enviada', 'clave_acceso' => null, 'numero_autorizacion' => null],
        ], 201),
    ]);

    (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient());

    Http::assertSent(function ($request) {
        return $request->data()['identificacion_comprador'] === '9999999999999';
    });
});

test('job uses billing_snapshot buyer data when doc_type is cedula', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'transfer',
        'status'             => 'completed',
        'billing_snapshot'   => [
            'doc_type'   => 'cedula',
            'doc_number' => '1234567890',
            'legal_name' => 'Ana García',
            'address'    => 'Quito, Ecuador',
        ],
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => ['id' => 'res-uuid-004', 'estado' => 'autorizada', 'clave_acceso' => str_repeat('2', 49), 'numero_autorizacion' => 'xyz'],
        ], 201),
    ]);

    (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient());

    Http::assertSent(function ($request) {
        $body = $request->data();
        return $body['identificacion_comprador']      === '1234567890'
            && $body['razon_social_comprador']        === 'Ana García'
            && $body['tipo_identificacion_comprador'] === '05'   // cedula
            && $body['forma_pago']                    === '16'   // transfer → 16
            && $body['direccion_comprador']            === 'Quito, Ecuador';
    });
});

// ─── Endpoint tests ───────────────────────────────────────────────────────────

test('POST /reservations/{id}/invoice dispatches job and returns 202', function () {
    Queue::fake();

    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'status'             => 'completed',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$reservation->id}/invoice");

    $response->assertStatus(202)
        ->assertJsonPath('data.message', 'Facturación iniciada.');

    Queue::assertPushed(EmitReservationInvoiceJob::class, function ($job) use ($reservation) {
        return $job->reservationId === $reservation->id;
    });
});

test('POST /reservations/{id}/invoice returns 422 if already autorizada', function () {
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'status'             => 'completed',
        'invoice_status'     => 'autorizada',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$reservation->id}/invoice");

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_INVOICED');
});

test('POST /reservations/{id}/invoice allows re-emit when status is rechazada', function () {
    Queue::fake();

    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'status'             => 'completed',
        'invoice_status'     => 'rechazada',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/reservations/{$reservation->id}/invoice");

    $response->assertStatus(202);
    Queue::assertPushed(EmitReservationInvoiceJob::class);
});
