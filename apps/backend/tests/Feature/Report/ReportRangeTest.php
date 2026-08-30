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

    // Los buckets del reporte salen del libro de pagos, no de las columnas del
    // servicio. Un log marcado 'paid' a mano ya no es un estado que la app
    // pueda producir: todo cobro nace en el libro. Este fixture cobra de
    // verdad, y el banco viaja con el pago en vez de estamparse después.
    $this->log = function (
        string $date,
        float $price,
        ?string $method,
        string $status = 'paid',
        ?string $bank = null,
    ) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $price,
            'payment_method' => null,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'log_date' => $date,
        ]);

        if ($status === 'paid' && $method !== null) {
            app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
                $log,
                $price,
                $method,
                $bank,
                $this->owner->id,
                // El pago pertenece al día del servicio, no al de la corrida:
                // el reporte filtra por paid_at.
                \Carbon\Carbon::parse($date . ' 12:00:00'),
            );
        }

        return $log->fresh();
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
    ($this->log)('2026-08-17', 100.00, 'transfer', 'paid', 'pichincha');
    ($this->log)('2026-08-17', 50.00, 'transfer', 'paid', 'guayaquil');
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
    ($this->log)('2026-08-17', 100.00, 'transfer', 'paid', 'pichincha');
    ($this->log)('2026-08-17', 130.00, 'transfer', 'paid', 'pichincha');
    ($this->log)('2026-08-17', 50.00, 'transfer', 'paid', 'guayaquil');

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
    ($this->log)('2026-08-17', 100.00, 'transfer', 'paid', 'pichincha');
    ($this->log)('2026-08-17', 50.00, 'transfer', 'paid', 'guayaquil');

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

/*
 * El servicio cobrado en dos partes. El 24 de agosto en FEDER: $74 cobrados
 * $60 en efectivo y $14 en transferencia. El log guarda UN método —se lo lleva
 * el último cobro— así que Reportes ponía los $74 enteros en transferencia y
 * mostraba $459 donde el Registro Diario mostraba $399. Los $60 de efectivo
 * desaparecían de su columna.
 */
function cobraMixto(callable $log, string $date, array $tramos): ServiceLogModel
{
    $total = array_sum(array_column($tramos, 1));
    $fila  = $log($date, $total, null, 'unpaid');

    foreach ($tramos as [$metodo, $monto, $banco]) {
        app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
            $fila,
            $monto,
            $metodo,
            $banco,
            test()->owner->id,
            \Carbon\Carbon::parse($date . ' 12:00:00'),
        );
    }

    return $fila->fresh();
}

test('the daily breakdown splits a ticket paid with two methods', function () {
    cobraMixto($this->log, '2026-08-17', [['cash', 60.00, null], ['transfer', 14.00, 'pichincha']]);

    $res = fetchRange('2026-08-17', '2026-08-17')->assertOk();

    // Lo cobrado con cada método, no el precio del servicio por su casillero.
    $res->assertJsonPath('data.daily_breakdown.0.by_cash', 60)
        ->assertJsonPath('data.daily_breakdown.0.by_transfer', 14)
        // El servicio sigue siendo uno y su precio sigue siendo $74.
        ->assertJsonPath('data.daily_breakdown.0.services', 1)
        ->assertJsonPath('data.daily_breakdown.0.revenue', 74);
});

test('filtering by method reports what came in through it, not the ticket price', function () {
    cobraMixto($this->log, '2026-08-17', [['cash', 60.00, null], ['transfer', 14.00, 'pichincha']]);
    ($this->log)('2026-08-17', 45.00, 'transfer', 'paid', 'pichincha');

    $res = test()
        ->actingAs(test()->owner)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/reports/range?date_from=2026-08-17&date_to=2026-08-17&payment_method=transfer')
        ->assertOk();

    // $14 del mixto + $45 del cobro puro. NO $74 + $45.
    $res->assertJsonPath('data.stats.total_revenue', 59)
        ->assertJsonPath('data.stats.collected_revenue', 59)
        ->assertJsonPath('data.stats.total_services', 2);
});

test('a ticket paid with two methods shows up under both filters', function () {
    cobraMixto($this->log, '2026-08-17', [['cash', 60.00, null], ['transfer', 14.00, 'pichincha']]);

    $porEfectivo = test()
        ->actingAs(test()->owner)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/reports/range?date_from=2026-08-17&date_to=2026-08-17&payment_method=cash')
        ->assertOk();

    // El mismo servicio aparece en los dos filtros, cada uno con su tramo:
    // filtrar por método pregunta por plata, no por servicios.
    $porEfectivo->assertJsonPath('data.stats.total_revenue', 60)
        ->assertJsonPath('data.stats.total_services', 1);
});

test('the headline and the per-method buckets agree under a filter', function () {
    // La contradicción que se veía en pantalla: 12 servicios listados cuyos
    // precios sumaban $459 bajo un titular que decía otra cosa.
    cobraMixto($this->log, '2026-08-17', [['cash', 60.00, null], ['transfer', 14.00, 'pichincha']]);
    ($this->log)('2026-08-17', 45.00, 'transfer', 'paid', 'pichincha');

    $res = test()
        ->actingAs(test()->owner)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/reports/range?date_from=2026-08-17&date_to=2026-08-17&payment_method=transfer')
        ->assertOk();

    expect($res->json('data.stats.total_revenue'))
        ->toBe($res->json('data.by_payment_method.transfer.total'));
});

/*
 * El 29 de agosto en FEDER: Caja del día marcaba $334 en transferencias y
 * Reportes $286. Los $48 que faltaban eran cuatro tickets del día anterior
 * cobrados ese día. Reportes partía de `log_date` y los dejaba afuera; la caja
 * parte de `paid_at` y los contaba. Las dos pantallas se contradecían sobre la
 * misma plata, y la que el dueño compara con el banco es la caja.
 *
 * Con un filtro de método la pregunta es "cuánto entró", así que el ticket de
 * ayer cobrado hoy es plata de hoy.
 */
function cobraElDia(callable $log, string $registrado, string $cobrado, float $monto, string $metodo, ?string $banco = null): ServiceLogModel
{
    $fila = $log($registrado, $monto, null, 'unpaid');

    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $fila,
        $monto,
        $metodo,
        $banco,
        test()->owner->id,
        \Carbon\Carbon::parse($cobrado . ' 09:00:00'),
    );

    return $fila->fresh();
}

test('a ticket from an earlier day collected inside the range is money of the range', function () {
    cobraElDia($this->log, '2026-08-16', '2026-08-17', 48.00, 'transfer', 'pichincha');
    ($this->log)('2026-08-17', 286.00, 'transfer', 'paid', 'pichincha');

    $res = test()
        ->actingAs(test()->owner)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/reports/range?date_from=2026-08-17&date_to=2026-08-17&payment_method=transfer')
        ->assertOk();

    $res->assertJsonPath('data.stats.total_revenue', 334)
        ->assertJsonPath('data.stats.collected_revenue', 334)
        ->assertJsonPath('data.stats.total_services', 2)
        // El gráfico también: la barra del día tiene que dar el titular.
        ->assertJsonPath('data.daily_breakdown.0.by_transfer', 334)
        ->assertJsonPath('data.daily_breakdown.0.revenue', 334)
        ->assertJsonPath('data.daily_breakdown.0.services', 2);

    // El titular y su propio desglose no pueden diferir.
    expect($res->json('data.stats.total_revenue'))
        ->toBe($res->json('data.by_payment_method.transfer.total'))
        ->and($res->json('data.by_bank.pichincha.total'))->toBe(334);
});

// Sin filtro la pregunta es otra —qué se trabajó en el rango— y ahí el ticket
// de ayer no es de hoy. Que el filtro cambie el criterio es a propósito; que lo
// cambie sin filtro sería mover la facturación de día.
test('without a method filter the range still reports what was registered in it', function () {
    cobraElDia($this->log, '2026-08-16', '2026-08-17', 48.00, 'transfer', 'pichincha');
    ($this->log)('2026-08-17', 286.00, 'transfer', 'paid', 'pichincha');

    fetchRange('2026-08-17', '2026-08-17')
        ->assertOk()
        ->assertJsonPath('data.stats.total_services', 1)
        ->assertJsonPath('data.stats.total_revenue', 286);
});

test('the bank chips list a bank that only appears through an earlier ticket', function () {
    // Único movimiento del día: un cobro sobre un ticket de ayer. La lista de
    // bancos salía de la columna del log, así que ese chip no existía y el
    // banco no se podía filtrar.
    cobraElDia($this->log, '2026-08-16', '2026-08-17', 14.00, 'transfer', 'guayaquil');

    expect(fetchRange('2026-08-17', '2026-08-17')->assertOk()->json('data.available_banks'))
        ->toEqualCanonicalizing(['guayaquil']);
});
