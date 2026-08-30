<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

/**
 * La pantalla de la cita en el portal dice "comunícate con el negocio" cuando
 * ya no se puede cancelar en línea, y no daba con qué: el recurso mandaba el
 * nombre, el slug y las horas de cancelación, nada para escribirle.
 *
 * El país viaja con el resto porque wa.me exige el número internacional y los
 * negocios lo guardan en formato local.
 */
test('the client reservation carries how to reach the business', function () {
    $tenant = TenantModel::factory()->create([
        'status' => 'active',
        'phone' => '0991213606',
        'country' => 'EC',
        'social_links' => ['whatsapp' => '0991213606'],
    ]);
    $client = UserModel::factory()->create(['email_verified_at' => now()]);
    TenantUserModel::create([
        'tenant_id' => $tenant->id,
        'user_id' => $client->id,
        'role' => 'client',
        'is_active' => true,
    ]);
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $resource = ClientResourceModel::withoutGlobalScopes()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $client->id,
        'type' => 'sedan',
        'data' => ['nombre' => 'Sebas'],
    ]);
    $reservation = ReservationModel::withoutGlobalScopes()->create([
        'client_resource_id' => $resource->id,
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $tenant->id,
        'client_id' => $client->id,
        'service_id' => $service->id,
        'scheduled_at' => now()->addDay(),
        'estimated_end' => now()->addDay()->addMinutes(30),
        'status' => 'pending',
        'created_by' => $client->id,
    ]);

    $this->actingAs($client, 'sanctum')
        ->getJson("/api/v1/client/reservations/{$reservation->id}")
        ->assertOk()
        ->assertJsonPath('data.tenant.whatsapp', '0991213606')
        ->assertJsonPath('data.tenant.phone', '0991213606')
        ->assertJsonPath('data.tenant.country', 'EC');
});
