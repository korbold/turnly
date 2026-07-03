<?php

use App\Infrastructure\Jobs\EmitServiceLogInvoiceJob;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Mail::fake();
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

// ---------------------------------------------------------------------------
// Job unit-level tests (queue = sync so the job runs inline)
// ---------------------------------------------------------------------------

test('job updates invoice fields to autorizada on billing success', function () {
    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => [
                'id'                    => 'inv-abc-123',
                'estado'                => 'autorizada',
                'clave_acceso'          => '1234567890123456789012345678901234567890123456789',
                'numero_autorizacion'   => '2024010112345678901',
            ],
        ], 200),
    ]);

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'price_charged'      => 15.00,
    ]);

    EmitServiceLogInvoiceJob::dispatchSync($log->id);

    $this->assertDatabaseHas('service_logs', [
        'id'             => $log->id,
        'invoice_status' => 'autorizada',
        'invoice_external_id' => 'inv-abc-123',
        'invoiced'       => true,
    ]);
});

test('job sets invoice_status to rechazada when billing service returns 500', function () {
    Http::fake([
        '*/api/invoices' => Http::response(['error' => 'Internal error'], 500),
    ]);

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'price_charged'      => 15.00,
    ]);

    // The job now re-throws after recording the error so the queue can retry.
    try {
        EmitServiceLogInvoiceJob::dispatchSync($log->id);
    } catch (\Throwable) {
        // Expected: job records rechazada then re-throws.
    }

    $log->refresh();
    expect($log->invoice_status)->toBe('rechazada')
        ->and($log->invoice_error)->not->toBeNull();
});

test('job uses consumidor final fallback when no billing profile exists', function () {
    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => [
                'id'     => 'inv-cf-001',
                'estado' => 'autorizada',
            ],
        ], 200),
    ]);

    // Client resource with no associated billing profile
    $anonClient = UserModel::factory()->create();
    $anonResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $anonClient->id,
        'type'      => 'sedan',
    ]);

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $anonResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'price_charged'      => 10.00,
    ]);

    EmitServiceLogInvoiceJob::dispatchSync($log->id);

    Http::assertSent(function ($request) {
        $body = $request->data();
        return $body['razon_social_comprador'] === 'CONSUMIDOR FINAL'
            && $body['identificacion_comprador'] === '9999999999999'
            && $body['tipo_identificacion_comprador'] === '07';
    });

    $this->assertDatabaseHas('service_logs', [
        'id'             => $log->id,
        'invoice_status' => 'autorizada',
    ]);
});

test('job uses client billing profile when one is available', function () {
    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => [
                'id'     => 'inv-profile-001',
                'estado' => 'autorizada',
            ],
        ], 200),
    ]);

    UserBillingProfileModel::create([
        'user_id'    => $this->user->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1712345678',
        'legal_name' => 'Juan Pérez',
        'address'    => 'Av. Principal 123',
        'email'      => 'juan@example.com',
        'is_default' => true,
    ]);

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'price_charged'      => 20.00,
    ]);

    EmitServiceLogInvoiceJob::dispatchSync($log->id);

    Http::assertSent(function ($request) {
        $body = $request->data();
        return $body['razon_social_comprador'] === 'Juan Pérez'
            && $body['identificacion_comprador'] === '1712345678'
            && $body['tipo_identificacion_comprador'] === '05'; // cedula
    });
});

// ---------------------------------------------------------------------------
// HTTP endpoint tests
// ---------------------------------------------------------------------------

test('POST service-logs/{id}/invoice returns 202 and dispatches job', function () {
    Queue::fake();

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'invoice_status'     => null,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice");

    $response->assertStatus(202);

    Queue::assertPushed(EmitServiceLogInvoiceJob::class, function ($job) use ($log) {
        return $job->serviceLogId === $log->id;
    });
});

test('POST service-logs/{id}/invoice returns 422 ALREADY_INVOICED when status is autorizada', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'invoice_status'     => 'autorizada',
        'invoiced'           => true,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice");

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_INVOICED');
});

test('GET invoices returns only service logs with a non-null invoice_status', function () {
    // Log with invoice
    ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'invoice_status'     => 'autorizada',
        'invoiced'           => true,
        'invoiced_at'        => now(),
    ]);

    // Log without invoice
    ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'invoice_status'     => null,
        'invoiced'           => false,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/invoices');

    $response->assertOk()
        ->assertJsonCount(1, 'data');
});
