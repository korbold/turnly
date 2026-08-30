<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

/*
 * Reports cover a range, not a day, and want the rows behind their totals.
 * Rather than a second listing endpoint, /service-logs learns date_from/date_to
 * and payment_bank so the filters, pagination and ordering stay in one place.
 */

beforeEach(function () {
    if (\DB::connection()->getDriverName() !== 'mysql') {
        test()->markTestSkipped(
            'El rango se prueba contra MySQL: en SQLite log_date conserva la hora y whereBetween no encuentra nada.'
        );
    }

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
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

    $this->log = function (string $date, float $price, ?string $method, ?string $bank = null) {
        return ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $price,
            'payment_method' => $method,
            'payment_bank' => $bank,
            'payment_status' => $method ? 'paid' : 'unpaid',
            'log_date' => $date,
        ]);
    };
});

function fetchLogsInRange(array $query = [])
{
    return test()
        ->actingAs(test()->owner)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/service-logs?' . http_build_query($query));
}

test('lists the services of a date range', function () {
    ($this->log)('2026-08-15', 10.00, 'cash');
    ($this->log)('2026-08-16', 20.00, 'cash');
    ($this->log)('2026-08-17', 30.00, 'cash');
    ($this->log)('2026-08-20', 40.00, 'cash');

    fetchLogsInRange(['date_from' => '2026-08-15', 'date_to' => '2026-08-17'])
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('a single date still works as before', function () {
    ($this->log)('2026-08-17', 10.00, 'cash');
    ($this->log)('2026-08-16', 20.00, 'cash');

    fetchLogsInRange(['date' => '2026-08-17'])->assertOk()->assertJsonCount(1, 'data');
});

test('filters a range by bank', function () {
    ($this->log)('2026-08-16', 10.00, 'transfer', 'pichincha');
    ($this->log)('2026-08-17', 20.00, 'transfer', 'guayaquil');
    ($this->log)('2026-08-17', 30.00, 'cash');

    fetchLogsInRange(['date_from' => '2026-08-16', 'date_to' => '2026-08-17', 'payment_bank' => 'pichincha'])
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.price_charged', 10);
});

test('combines the range with the payment and search filters', function () {
    ($this->log)('2026-08-16', 10.00, null);
    ($this->log)('2026-08-17', 20.00, 'cash');

    fetchLogsInRange(['date_from' => '2026-08-16', 'date_to' => '2026-08-17', 'payment' => 'pending'])
        ->assertOk()
        ->assertJsonCount(1, 'data');

    fetchLogsInRange(['date_from' => '2026-08-16', 'date_to' => '2026-08-17', 'q' => 'ibb9762'])
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('paginates a range', function () {
    foreach (range(1, 12) as $i) {
        ($this->log)('2026-08-17', 10.00, 'cash');
    }

    fetchLogsInRange(['date_from' => '2026-08-01', 'date_to' => '2026-08-31', 'per_page' => 10])
        ->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta.total', 12);
});

/*
 * La tabla de Reportes lista las filas detrás de sus propios totales, así que
 * tiene que tener la misma población que ellos. Con un método pedido, esa
 * población sale del libro de pagos: el ticket de ayer cobrado hoy entra, y el
 * de hoy que nadie cobró con ese método no.
 *
 * Antes cortaba por `log_date` y quedaba una tabla de 15 filas sumando $286
 * debajo de un titular que decía $334.
 */
test('a range filtered by method lists the tickets that were collected in it', function () {
    $ayer = ($this->log)('2026-08-16', 48.00, null);
    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $ayer, 48.00, 'transfer', 'pichincha', $this->owner->id,
        \Carbon\Carbon::parse('2026-08-17 09:00:00'),
    );

    $hoy = ($this->log)('2026-08-17', 20.00, null);
    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $hoy, 20.00, 'transfer', 'pichincha', $this->owner->id,
        \Carbon\Carbon::parse('2026-08-17 15:00:00'),
    );

    // Registrado hoy pero cobrado en efectivo: no es plata de transferencia.
    $efectivo = ($this->log)('2026-08-17', 30.00, null);
    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $efectivo, 30.00, 'cash', null, $this->owner->id,
        \Carbon\Carbon::parse('2026-08-17 16:00:00'),
    );

    $res = fetchLogsInRange([
        'date_from' => '2026-08-17', 'date_to' => '2026-08-17', 'payment' => 'transfer',
    ])->assertOk()->assertJsonCount(2, 'data');

    expect(collect($res->json('data'))->pluck('id')->all())
        ->toEqualCanonicalizing([$ayer->id, $hoy->id]);
});

test('a range filtered by method and bank follows the payment, not the log column', function () {
    $ayer = ($this->log)('2026-08-16', 14.00, null);
    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $ayer, 14.00, 'transfer', 'guayaquil', $this->owner->id,
        \Carbon\Carbon::parse('2026-08-17 09:00:00'),
    );

    $otro = ($this->log)('2026-08-17', 22.00, null);
    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $otro, 22.00, 'transfer', 'pichincha', $this->owner->id,
        \Carbon\Carbon::parse('2026-08-17 10:00:00'),
    );

    fetchLogsInRange([
        'date_from' => '2026-08-17', 'date_to' => '2026-08-17',
        'payment' => 'transfer', 'payment_bank' => 'guayaquil',
    ])
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $ayer->id);
});

// El Registro Diario sigue siendo la lista del día: filtrar por método ahí no
// puede traer el trabajo de ayer aunque se haya cobrado hoy.
test('the daily list is not moved by a payment from another day', function () {
    $ayer = ($this->log)('2026-08-16', 48.00, null);
    app(\App\Application\Services\PaymentLedger::class)->recordForServiceLog(
        $ayer, 48.00, 'transfer', 'pichincha', $this->owner->id,
        \Carbon\Carbon::parse('2026-08-17 09:00:00'),
    );

    fetchLogsInRange(['date' => '2026-08-17', 'payment' => 'transfer'])
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
