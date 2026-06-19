<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user   = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    AvailabilitySlotModel::create([
        'tenant_id'      => $this->tenant->id,
        'day_of_week'    => 0, // filled in test with actual day
        'start_time'     => '08:00:00',
        'end_time'       => '18:00:00',
        'max_concurrent' => 5,
        'is_active'      => true,
    ]);

    $this->resource = BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Silla 1',
        'type'       => 'physical',
        'is_active'  => true,
        'sort_order' => 0,
    ]);
});

test('available slots without resource filter returns all slots', function () {
    $date = now()->addDay()->format('Y-m-d');
    $dayOfWeek = (int) now()->addDay()->format('N') - 1;

    // Update availability slot to match the test day
    \App\Infrastructure\Persistence\Models\AvailabilitySlotModel::query()
        ->forTenant($this->tenant->id)
        ->update(['day_of_week' => $dayOfWeek]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}");

    $response->assertOk();
    expect(count($response->json('data')))->toBeGreaterThan(0);
});

test('available slots filtered by resource excludes occupied slots', function () {
    $date     = now()->addDay()->format('Y-m-d');
    $dayOfWeek = (int) now()->addDay()->format('N') - 1;

    \App\Infrastructure\Persistence\Models\AvailabilitySlotModel::query()
        ->forTenant($this->tenant->id)
        ->update(['day_of_week' => $dayOfWeek]);

    $occupiedStart = now()->addDay()->setHour(9)->setMinute(0)->setSecond(0);
    $occupiedEnd   = (clone $occupiedStart)->addMinutes(30);

    $otherClient = UserModel::factory()->create();
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $otherClient->id,
    ]);

    ReservationModel::withoutGlobalScopes()->create([
        'id'                   => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'            => $this->tenant->id,
        'client_id'            => $otherClient->id,
        'service_id'           => $this->service->id,
        'created_by'           => $otherClient->id,
        'business_resource_id' => $this->resource->id,
        'client_resource_id'   => $clientResource->id,
        'scheduled_at'         => $occupiedStart,
        'estimated_end'        => $occupiedEnd,
        'status'               => 'pending',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}&business_resource_id={$this->resource->id}");

    $response->assertOk();

    $slots = $response->json('data');
    $occupiedSlotStart = $occupiedStart->format('Y-m-d H:i:s');
    $found = collect($slots)->first(fn ($s) => $s['start'] === $occupiedSlotStart);

    // The occupied slot must NOT appear when filtering by that resource
    expect($found)->toBeNull();
});
