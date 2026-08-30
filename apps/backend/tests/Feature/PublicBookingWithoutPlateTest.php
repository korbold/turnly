<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;

/**
 * Hay un índice único en (tenant_id, plate). El panel guarda NULL cuando no hay
 * placa y dos NULL no chocan en MySQL; el endpoint público guardaba cadena
 * vacía, y dos cadenas vacías SÍ chocan.
 *
 * Efecto en producción: una peluquería —o cualquier negocio que no pide placa—
 * aceptaba UNA sola reserva web en toda su vida. La segunda moría con un 500 y
 * el cliente veía "Error al crear la reserva. Intenta de nuevo.", que es
 * exactamente el consejo que nunca iba a funcionar.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'slug' => 'sin-placa']);
    TenantImageModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'storage_path' => '/t.jpg',
        'url' => 'https://example.com/t.jpg',
        'sort_order' => 0,
    ]);
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->service = $service;
    ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Default',
        'price' => 7,
        'duration_min' => 30,
    ]);
});

function bookNoPlate(string $slug, string $serviceId, string $email, string $childName)
{
    return test()->postJson("/api/v1/public/tenants/{$slug}/book", [
        'service_id' => $serviceId,
        'scheduled_at' => \Carbon\Carbon::tomorrow(config('app.timezone'))->setTime(9, 0)->format('Y-m-d H:i:s'),
        'client_name' => 'Cliente',
        'client_email' => $email,
        'client_phone' => '0999123456',
        // Una peluquería pide el nombre del niño. Nunca una placa.
        'client_resource_data' => ['nombre' => $childName],
    ]);
}

test('a shop that does not ask for a plate takes more than one booking', function () {
    bookNoPlate($this->tenant->slug, $this->service->id, 'uno@example.com', 'Sebastián')
        ->assertCreated();

    bookNoPlate($this->tenant->slug, $this->service->id, 'dos@example.com', 'Martina')
        ->assertCreated();

    expect(ClientResourceModel::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->count())
        ->toBe(2);
});

test('a missing plate is stored as null, never as an empty string', function () {
    bookNoPlate($this->tenant->slug, $this->service->id, 'uno@example.com', 'Sebastián')
        ->assertCreated();

    $resource = ClientResourceModel::withoutGlobalScopes()
        ->where('tenant_id', $this->tenant->id)
        ->first();

    expect($resource->plate)->toBeNull();
    // El dato que el negocio sí pidió sigue guardado.
    expect($resource->data['nombre'])->toBe('Sebastián');
});
