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

    \App\Infrastructure\Persistence\Models\TenantUserModel::create([
        'id'        => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->user->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);
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

test('POST service-logs/{id}/payment marks paid WITHOUT auto-dispatching invoice', function () {
    // Facturación is now a manual step (the "Facturar" button). Recording a
    // payment must only mark the log paid — it must NOT auto-emit the SRI
    // invoice the way it used to.
    Queue::fake();

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'unpaid',
        'invoice_status'     => null,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/payment", [
            'method' => 'cash',
        ]);

    $response->assertStatus(200);

    $this->assertDatabaseHas('service_logs', [
        'id'             => $log->id,
        'payment_status' => 'paid',
    ]);

    Queue::assertNotPushed(EmitServiceLogInvoiceJob::class);
});

// ---------------------------------------------------------------------------
// Fiscal-data correction (GET/PUT service-logs/{id}/billing)
// ---------------------------------------------------------------------------

function makeBillableLog(): ServiceLogModel
{
    return ServiceLogModel::factory()->create([
        'tenant_id'          => test()->tenant->id,
        'client_resource_id' => test()->clientResource->id,
        'service_id'         => test()->service->id,
        'attended_by'        => test()->user->id,
        'created_by'         => test()->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
    ]);
}

test('GET service-logs/{id}/billing falls back to consumidor final when no profile', function () {
    $log = makeBillableLog();

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs/{$log->id}/billing")
        ->assertOk()
        ->assertJsonPath('data.doc_type', 'final_consumer')
        ->assertJsonPath('data.doc_number', '');
});

test('GET service-logs/{id}/billing returns the client default profile', function () {
    UserBillingProfileModel::create([
        'user_id'    => $this->user->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1710034065',
        'legal_name' => 'Juan Perez',
        'email'      => 'juan@example.com',
        'address'    => 'Av Siempre Viva',
        'is_default' => true,
    ]);
    $log = makeBillableLog();

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs/{$log->id}/billing")
        ->assertOk()
        ->assertJsonPath('data.doc_type', 'cedula')
        ->assertJsonPath('data.doc_number', '1710034065')
        ->assertJsonPath('data.legal_name', 'Juan Perez');
});

test('PUT service-logs/{id}/billing creates a default profile when none exists', function () {
    $log = makeBillableLog();

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$log->id}/billing", [
            'doc_type'   => 'ruc',
            'doc_number' => '1710034065001',
            'legal_name' => 'Acme S.A.',
            'email'      => 'facturacion@acme.com',
            'address'    => 'Quito',
        ])
        ->assertOk()
        ->assertJsonPath('data.legal_name', 'Acme S.A.');

    $this->assertDatabaseHas('user_billing_profiles', [
        'user_id'    => $this->user->id,
        'doc_number' => '1710034065001',
        'is_default' => true,
    ]);
});

test('PUT service-logs/{id}/billing edits the default profile in place (no duplicate)', function () {
    UserBillingProfileModel::create([
        'user_id'    => $this->user->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1710034065',
        'legal_name' => 'Nombre Viejo',
        'email'      => 'viejo@example.com',
        'is_default' => true,
    ]);
    $log = makeBillableLog();

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$log->id}/billing", [
            'doc_type'   => 'cedula',
            'doc_number' => '1710034065',
            'legal_name' => 'Nombre Corregido',
            'email'      => 'nuevo@example.com',
        ])
        ->assertOk();

    expect(UserBillingProfileModel::where('user_id', $this->user->id)->count())->toBe(1);
    $this->assertDatabaseHas('user_billing_profiles', [
        'user_id'    => $this->user->id,
        'legal_name' => 'Nombre Corregido',
        'email'      => 'nuevo@example.com',
    ]);
});

test('PUT service-logs/{id}/billing rejects an invalid cedula', function () {
    $log = makeBillableLog();

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$log->id}/billing", [
            'doc_type'   => 'cedula',
            'doc_number' => '1234567890',
            'legal_name' => 'Bad Cedula',
            'email'      => 'x@example.com',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'INVALID_CEDULA');
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
