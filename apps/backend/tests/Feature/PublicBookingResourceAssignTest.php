<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'slug'     => 'test-shop',
        'settings' => ['allow_client_resource_selection' => false],
    ]);

    TenantImageModel::create([
        'id'           => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'    => $this->tenant->id,
        'storage_path' => '/test.jpg',
        'url'          => 'https://example.com/test.jpg',
        'sort_order'   => 0,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->variant = ServiceVariantModel::create([
        'tenant_id'    => $this->tenant->id,
        'service_id'   => $this->service->id,
        'label'        => 'Default',
        'price'        => 10,
        'duration_min' => 30,
    ]);

    $this->resource = BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Estación 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
    ]);
});

$vehicleData = ['plate' => 'ABC1234', 'brand' => 'Toyota', 'model' => 'Corolla', 'type' => 'sedan'];

test('public book auto-assigns business resource', function () use ($vehicleData) {
    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'items'                => [['service_variant_id' => $this->variant->id, 'qty' => 1]],
        'scheduled_at'         => now()->addHours(2)->toIso8601String(),
        'client_name'          => 'Ana Pérez',
        'client_email'         => 'ana@example.com',
        'client_resource_data' => $vehicleData,
    ]);

    $response->assertCreated();

    $reservation = ReservationModel::withoutGlobalScopes()->latest('created_at')->first();
    expect($reservation->business_resource_id)->toBe($this->resource->id);
});

test('public book returns 409 when all resources occupied', function () use ($vehicleData) {
    $scheduledAt  = now()->addHours(2);
    $estimatedEnd = (clone $scheduledAt)->addMinutes(30);
    $otherClient  = \App\Infrastructure\Persistence\Models\UserModel::factory()->create();

    ReservationModel::withoutGlobalScopes()->create([
        'id'                   => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'            => $this->tenant->id,
        'client_id'            => $otherClient->id,
        'service_id'           => $this->service->id,
        'created_by'           => $otherClient->id,
        'business_resource_id' => $this->resource->id,
        'client_resource_id'   => \App\Infrastructure\Persistence\Models\ClientResourceModel::factory()->create(['tenant_id' => $this->tenant->id, 'client_id' => $otherClient->id])->id,
        'scheduled_at'         => $scheduledAt,
        'estimated_end'        => $estimatedEnd,
        'status'               => 'pending',
    ]);

    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'items'                => [['service_variant_id' => $this->variant->id, 'qty' => 1]],
        'scheduled_at'         => $scheduledAt->toIso8601String(),
        'client_name'          => 'Bob Smith',
        'client_email'         => 'bob@example.com',
        'client_resource_data' => $vehicleData,
    ]);

    $response->assertStatus(409);
    $response->assertJsonPath('error.code', 'NO_RESOURCE_AVAILABLE');
});

test('public book accepts client-selected resource when allow_client_resource_selection is true', function () use ($vehicleData) {
    $settings = $this->tenant->settings;
    $settings['allow_client_resource_selection'] = true;
    $this->tenant->update(['settings' => $settings]);

    $r2 = BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Estación 2',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 1,
    ]);

    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'items'                => [['service_variant_id' => $this->variant->id, 'qty' => 1]],
        'scheduled_at'         => now()->addHours(2)->toIso8601String(),
        'client_name'          => 'Ana Pérez',
        'client_email'         => 'ana@example.com',
        'client_resource_data' => $vehicleData,
        'business_resource_id' => $r2->id,
    ]);

    $response->assertCreated();
    $reservation = ReservationModel::withoutGlobalScopes()->latest('created_at')->first();
    expect($reservation->business_resource_id)->toBe($r2->id);
});

test('public book skips resource assignment when tenant has no active resources', function () use ($vehicleData) {
    $this->resource->update(['is_active' => false]);

    $response = $this->postJson("/api/v1/public/tenants/{$this->tenant->slug}/book", [
        'items'                => [['service_variant_id' => $this->variant->id, 'qty' => 1]],
        'scheduled_at'         => now()->addHours(2)->toIso8601String(),
        'client_name'          => 'Ana Pérez',
        'client_email'         => 'ana@example.com',
        'client_resource_data' => $vehicleData,
    ]);

    $response->assertCreated();
    $reservation = ReservationModel::withoutGlobalScopes()->latest('created_at')->first();
    expect($reservation->business_resource_id)->toBeNull();
});
