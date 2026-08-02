<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'settings' => ['slot_duration_minutes' => 30]]);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id, 'role' => 'owner', 'is_active' => true,
    ]);
});

function durSlot(object $t, int $day, string $start, string $end, int $maxConcurrent = 1): void
{
    AvailabilitySlotModel::create([
        'tenant_id' => $t->tenant->id, 'day_of_week' => $day,
        'start_time' => $start, 'end_time' => $end,
        'max_concurrent' => $maxConcurrent, 'is_active' => true,
    ]);
}

function durVariant(object $t, int $duration, float $price = 10): ServiceVariantModel
{
    return ServiceVariantModel::create([
        'tenant_id' => $t->tenant->id, 'service_id' => $t->service->id,
        'label' => "v{$duration}", 'price' => $price, 'duration_min' => $duration,
    ]);
}

test('available-slots duration_min widens each slot so fewer fit before close', function () {
    $day = (int) now()->addDay()->format('N') - 1;
    durSlot($this, $day, '08:00:00', '10:00:00', 5);
    $date = now()->addDay()->format('Y-m-d');

    $base = $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}")
        ->assertOk()->json('data');

    $long = $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reservations/available-slots?date={$date}&service_id={$this->service->id}&duration_min=90")
        ->assertOk()->json('data');

    // 08:00-10:00 = 120 min. 30-min slots → 4 start times; a 90-min block only
    // fits starting 08:00 and 08:30 → fewer slots.
    expect(count($long))->toBeLessThan(count($base));
    expect(count($long))->toBeGreaterThan(0);
});

test('multi-item reservation blocks its real summed span for max_concurrent', function () {
    $day = (int) now()->addDay()->format('N') - 1;
    durSlot($this, $day, '00:00:00', '23:59:00', 1); // max_concurrent = 1
    $v1 = durVariant($this, 45);
    $v2 = durVariant($this, 45);

    $at = now()->addDay()->setTime(9, 0, 0);

    // Reservation A: two 45-min lines = 90 min → 09:00-10:30
    $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'scheduled_at' => $at->toIso8601String(),
            'items' => [
                ['service_variant_id' => $v1->id, 'qty' => 1],
                ['service_variant_id' => $v2->id, 'qty' => 1],
            ],
        ])->assertStatus(201);

    $reservation = \App\Infrastructure\Persistence\Models\ReservationModel::query()->latest('created_at')->first();
    expect(ReservationItemModel::where('reservation_id', $reservation->id)->count())->toBe(2);
    // estimated_end stretched to +90 min
    expect(\Illuminate\Support\Carbon::parse($reservation->estimated_end)->format('H:i'))->toBe('10:30');

    // Reservation B at 10:00 falls INSIDE A's real 90-min span → must conflict
    // (before the fix, A was validated as 30 min ending 09:30, so B was allowed).
    // ReservationConflictException::getStatusCode() returns 409 (bootstrap/app.php
    // renders AppException with $e->getStatusCode()), not 422.
    $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'scheduled_at' => now()->addDay()->setTime(10, 0, 0)->toIso8601String(),
            'items' => [['service_variant_id' => $v1->id, 'qty' => 1]],
        ])->assertStatus(409);
});

test('legacy single service_id reservation still creates', function () {
    durSlot($this, (int) now()->addDay()->format('N') - 1, '00:00:00', '23:59:00', 10);

    $this->actingAs($this->user)->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/reservations', [
            'client_resource_id' => $this->clientResource->id,
            'service_id' => $this->service->id,
            'scheduled_at' => now()->addDay()->setTime(9, 0, 0)->toIso8601String(),
        ])->assertStatus(201);
});
