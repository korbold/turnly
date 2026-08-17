<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

/*
 * Run these against MySQL, not the default SQLite:
 *
 *   DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Report
 *
 * `log_date` is a DATE column in production, but SQLite has no such type and
 * keeps the model's "2026-08-17 00:00:00" verbatim, so whereBetween() misses
 * every row and the whole report comes back empty — a failure the production
 * schema does not have.
 */

beforeEach(function () {
    if (\DB::connection()->getDriverName() !== 'mysql') {
        test()->markTestSkipped(
            'Reportes se prueban contra MySQL: en SQLite log_date conserva la hora y whereBetween no encuentra nada.'
        );
    }

    $plan = PlanModel::create([
        'name' => 'Test', 'slug' => 'test-' . Str::random(6), 'price' => 0,
        'has_reports' => true, 'is_active' => true, 'sort_order' => 1,
    ]);

    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'plan_id' => $plan->id,
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $client = UserModel::factory()->create();
    $this->resource = ClientResourceModel::create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $client->id,
        'data' => ['plate' => 'IBB9762'],
    ]);

    $this->log = function (string $date, float $price, ?string $method, string $status = 'paid') {
        return ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $price,
            'payment_method' => $method,
            'payment_status' => $status,
            'log_date' => $date,
        ]);
    };
});

function fetchRange(string $from, string $to)
{
    return test()
        ->actingAs(test()->owner)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson("/api/v1/reports/range?date_from={$from}&date_to={$to}");
}

// log_date is cast to 'date', so the model hands back a Carbon whose string form
// is "2026-08-17 00:00:00". Filtering the loaded collection against the plain
// "2026-08-17" matched nothing, and the per-day breakdown silently returned
// zeros under headline totals that were right — the same screen contradicting
// itself.
test('the daily breakdown counts the services of the day', function () {
    ($this->log)('2026-08-17', 433.00, 'cash');
    ($this->log)('2026-08-17', 122.00, 'transfer');

    $res = fetchRange('2026-08-17', '2026-08-17')->assertOk();

    $res->assertJsonPath('data.stats.total_services', 2)
        ->assertJsonPath('data.stats.total_revenue', 555)
        ->assertJsonPath('data.daily_breakdown.0.date', '2026-08-17')
        ->assertJsonPath('data.daily_breakdown.0.services', 2)
        ->assertJsonPath('data.daily_breakdown.0.revenue', 555)
        ->assertJsonPath('data.daily_breakdown.0.by_cash', 433)
        ->assertJsonPath('data.daily_breakdown.0.by_transfer', 122);
});

test('the daily average is not zero when there was revenue', function () {
    ($this->log)('2026-08-16', 100.00, 'cash');
    ($this->log)('2026-08-17', 300.00, 'cash');

    fetchRange('2026-08-16', '2026-08-17')
        ->assertOk()
        ->assertJsonPath('data.stats.average_daily_revenue', 200);
});

test('each day of a range gets its own figures', function () {
    ($this->log)('2026-08-15', 50.00, 'cash');
    ($this->log)('2026-08-17', 70.00, 'card');

    $res = fetchRange('2026-08-15', '2026-08-17')->assertOk();

    // Day with activity, empty day in the middle, day with activity.
    $res->assertJsonPath('data.daily_breakdown.0.revenue', 50)
        ->assertJsonPath('data.daily_breakdown.1.revenue', 0)
        ->assertJsonPath('data.daily_breakdown.1.services', 0)
        ->assertJsonPath('data.daily_breakdown.2.revenue', 70)
        ->assertJsonPath('data.daily_breakdown.2.by_card', 70);
});

// The donut has to add up to the headline. An unpaid service carries a price but
// no method, so it landed in the revenue total and in no bucket — $581 of income
// over a $555 breakdown, on the screen the accountant reads.
test('reports what was collected apart from what is still owed', function () {
    ($this->log)('2026-08-17', 433.00, 'cash');
    ($this->log)('2026-08-17', 122.00, 'transfer');
    ($this->log)('2026-08-17', 26.00, null, 'unpaid');

    $res = fetchRange('2026-08-17', '2026-08-17')->assertOk();

    $res->assertJsonPath('data.stats.collected_revenue', 555)
        ->assertJsonPath('data.stats.unpaid_revenue', 26)
        ->assertJsonPath('data.stats.unpaid_count', 1)
        // Everything registered, collected or not, keeps its own figure.
        ->assertJsonPath('data.stats.total_revenue', 581)
        ->assertJsonPath('data.stats.total_services', 3);

    // The buckets add up to what was collected, not to the registered total.
    $cash = $res->json('data.by_payment_method.cash.total');
    $transfer = $res->json('data.by_payment_method.transfer.total');
    $card = $res->json('data.by_payment_method.card.total');
    expect((float) ($cash + $transfer + $card))->toBe(555.0);
});

test('the daily breakdown separates collected from owed too', function () {
    ($this->log)('2026-08-17', 100.00, 'cash');
    ($this->log)('2026-08-17', 40.00, null, 'unpaid');

    fetchRange('2026-08-17', '2026-08-17')
        ->assertOk()
        ->assertJsonPath('data.daily_breakdown.0.revenue', 140)
        ->assertJsonPath('data.daily_breakdown.0.collected', 100)
        ->assertJsonPath('data.daily_breakdown.0.unpaid', 40);
});

test('a range with no activity reports zeros without dividing by zero', function () {
    fetchRange('2026-08-10', '2026-08-11')
        ->assertOk()
        ->assertJsonPath('data.stats.total_revenue', 0)
        ->assertJsonPath('data.stats.average_daily_revenue', 0)
        ->assertJsonPath('data.daily_breakdown.0.services', 0);
});

/*
 * service_logs has carried payment_bank since the 400001 migration, but the
 * report still assumed banks only lived on reservations and dropped every log
 * when a bank filter was on. In production 100% of the transfers with a bank
 * are service logs, so the filter returned nothing at all.
 */
test('filtering by bank keeps the services paid with that bank', function () {
    ($this->log)('2026-08-17', 100.00, 'transfer')->update(['payment_bank' => 'pichincha']);
    ($this->log)('2026-08-17', 50.00, 'transfer')->update(['payment_bank' => 'guayaquil']);
    ($this->log)('2026-08-17', 30.00, 'cash');

    $res = test()
        ->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/reports/range?date_from=2026-08-17&date_to=2026-08-17&payment_method=transfer&payment_bank=pichincha')
        ->assertOk();

    $res->assertJsonPath('data.stats.total_services', 1)
        ->assertJsonPath('data.stats.total_revenue', 100)
        ->assertJsonPath('data.daily_breakdown.0.services', 1)
        ->assertJsonPath('data.daily_breakdown.0.by_transfer', 100);
});

test('the bank breakdown counts services, not only reservations', function () {
    ($this->log)('2026-08-17', 100.00, 'transfer')->update(['payment_bank' => 'pichincha']);
    ($this->log)('2026-08-17', 130.00, 'transfer')->update(['payment_bank' => 'pichincha']);
    ($this->log)('2026-08-17', 50.00, 'transfer')->update(['payment_bank' => 'guayaquil']);

    $res = fetchRange('2026-08-17', '2026-08-17')->assertOk();

    $res->assertJsonPath('data.by_bank.pichincha.count', 2)
        ->assertJsonPath('data.by_bank.pichincha.total', 230)
        ->assertJsonPath('data.by_bank.guayaquil.count', 1)
        ->assertJsonPath('data.by_bank.guayaquil.total', 50);
});

// The chips let you switch banks, so they can't be derived from the filtered
// result: picking Pichincha dropped every other bank from the list and left the
// user with no way back except clearing the filter.
test('the bank list survives filtering by one bank', function () {
    ($this->log)('2026-08-17', 100.00, 'transfer')->update(['payment_bank' => 'pichincha']);
    ($this->log)('2026-08-17', 50.00, 'transfer')->update(['payment_bank' => 'guayaquil']);

    $sinFiltro = fetchRange('2026-08-17', '2026-08-17')->assertOk();
    expect($sinFiltro->json('data.available_banks'))
        ->toEqualCanonicalizing(['pichincha', 'guayaquil']);

    $filtrado = test()
        ->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/reports/range?date_from=2026-08-17&date_to=2026-08-17&payment_method=transfer&payment_bank=pichincha')
        ->assertOk();

    // Narrowed figures, full list of banks to switch to.
    expect($filtrado->json('data.stats.total_revenue'))->toBe(100)
        ->and($filtrado->json('data.available_banks'))
        ->toEqualCanonicalizing(['pichincha', 'guayaquil']);
});
