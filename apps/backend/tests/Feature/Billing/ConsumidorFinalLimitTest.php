<?php

use App\Domain\Billing\ConsumidorFinalLimit;
use App\Infrastructure\Jobs\EmitServiceLogInvoiceJob;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

beforeEach(function () {
    Mail::fake();

    $this->tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'settings' => ['iva_mode' => 'included'],
    ]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);

    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->user->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

function makeLog(array $attrs = []): ServiceLogModel
{
    return ServiceLogModel::factory()->create(array_merge([
        'tenant_id'          => test()->tenant->id,
        'client_resource_id' => test()->clientResource->id,
        'service_id'         => test()->service->id,
        'attended_by'        => test()->user->id,
        'created_by'         => test()->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
    ], $attrs));
}

// The SRI caps CONSUMIDOR FINAL at $50 per comprobante. Emitting anyway
// consumed a secuencial and came back as "ERROR EN LA IDENTIFICACION DEL
// RECEPTOR" (69), which reads like a glitch and invites endless retries.
test('facturar is refused for a consumidor final sale over $50', function () {
    Http::fake();

    $log = makeLog(['price_charged' => 63.00]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice")
        ->assertStatus(422)
        ->assertJsonPath('error.code', ConsumidorFinalLimit::CODE);

    Http::assertNothingSent();
});

test('facturar goes through once the client has a real cédula', function () {
    Http::fake([
        '*/api/invoices' => Http::response(['data' => [
            'id' => 'inv-1', 'estado' => 'enviada', 'clave_acceso' => str_repeat('1', 49),
        ]], 200),
    ]);

    UserBillingProfileModel::create([
        'user_id'    => $this->user->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1004296905',
        'legal_name' => 'Marta Ruiz',
        'email'      => 'marta@example.com',
        'is_default' => true,
    ]);

    $log = makeLog(['price_charged' => 63.00]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice")
        ->assertStatus(202);
});

test('a consumidor final sale at or under $50 still invoices', function () {
    Http::fake([
        '*/api/invoices' => Http::response(['data' => [
            'id' => 'inv-2', 'estado' => 'enviada', 'clave_acceso' => str_repeat('1', 49),
        ]], 200),
    ]);

    $log = makeLog(['price_charged' => 50.00]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice")
        ->assertStatus(202);
});

// Invoice-on-payment dispatches the job directly, bypassing the controller.
test('the job records the reason instead of calling the SRI', function () {
    Http::fake();

    $log = makeLog(['price_charged' => 63.00]);

    EmitServiceLogInvoiceJob::dispatchSync($log->id);

    Http::assertNothingSent();

    expect($log->fresh()->invoice_status)->toBe('rechazada')
        ->and($log->fresh()->invoice_error)->toBe(ConsumidorFinalLimit::MESSAGE)
        ->and($log->fresh()->invoiced)->toBeFalsy();
});

// Tenants on `excluded` display net prices, so a $45 ticket really bills
// $51.75 and the SRI would reject it.
test('net prices are grossed up before the $50 comparison', function () {
    expect(ConsumidorFinalLimit::blocks(true, ConsumidorFinalLimit::totalWithIva(45.00, 'excluded')))->toBeTrue()
        ->and(ConsumidorFinalLimit::blocks(true, ConsumidorFinalLimit::totalWithIva(45.00, 'included')))->toBeFalse()
        ->and(ConsumidorFinalLimit::blocks(false, 1000.00))->toBeFalse();
});
