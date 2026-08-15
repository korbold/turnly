<?php

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

beforeEach(function () {
    // 18:00 local, well past the morning slots below.
    Carbon::setTestNow(Carbon::parse('2026-08-17 18:00:00'));

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    AvailabilitySlotModel::create([
        'id'             => (string) Str::uuid(),
        'tenant_id'      => $this->tenant->id,
        'day_of_week'    => (int) Carbon::parse('2026-08-17')->format('N') - 1,
        'start_time'     => '08:00',
        'end_time'       => '20:00',
        'max_concurrent' => 2,
        'is_active'      => true,
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

afterEach(fn () => Carbon::setTestNow());

function slotsFor(string $date): array
{
    $res = test()->getJson(
        "/api/v1/public/tenants/" . test()->tenant->slug . "/available-slots"
        . "?service_id=" . test()->service->id . "&date={$date}",
    );

    $res->assertOk();

    return $res->json('data');
}

// A customer picking 08:00 at 18:00 only found out it was invalid at the
// end of the booking flow, after typing name, email and phone.
test('slots already past are not offered for today', function () {
    $starts = array_column(slotsFor('2026-08-17'), 'start');

    expect($starts)->not->toBeEmpty();

    foreach ($starts as $start) {
        expect(Carbon::parse($start)->greaterThan(Carbon::now()))->toBeTrue();
    }
});

test('a future date still offers the whole day', function () {
    $starts = array_column(slotsFor('2026-08-24'), 'start');

    expect($starts[0])->toContain('08:00:00');
});
