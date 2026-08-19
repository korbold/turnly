<?php
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\{ClientResourceModel,ServiceLogModel,ServiceModel,TenantModel,TenantUserModel,UserModel};
use Illuminate\Support\Str;

// Los tiles de caja salen del libro de pagos, no de las columnas del
// servicio. Un log marcado 'paid' a mano ya no es un estado que la app pueda
// producir: todo cobro nace en el libro. Estos fixtures cobran de verdad.
function cobrar(ServiceLogModel $log, string $method, string $receivedBy): void
{
    app(PaymentLedger::class)->recordForServiceLog(
        $log, (float) $log->price_charged, $method, null, $receivedBy
    );
}

// A day paid by transfer must show up in the caja tiles, not just in the
// revenue headline.
test('the daily summary breaks down transfer and other', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $cr = ClientResourceModel::factory()->create(['tenant_id' => $tenant->id, 'client_id' => $user->id, 'type' => 'sedan']);
    TenantUserModel::create(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => 'owner', 'is_active' => true]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    foreach ([['transfer', 63.00], ['other', 10.00], ['cash', 5.00]] as [$method, $price]) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $tenant->id, 'client_resource_id' => $cr->id, 'service_id' => $service->id,
            'attended_by' => $user->id, 'created_by' => $user->id, 'payment_method' => null,
            'payment_status' => 'unpaid', 'price_charged' => $price, 'log_date' => now()->toDateString(),
        ]);
        cobrar($log, $method, $user->id);
    }

    $res = $this->actingAs($user)->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/service-logs/summary?date=' . now()->toDateString());

    $res->assertOk()
        ->assertJsonPath('data.by_payment_method.transfer.total', 63)
        ->assertJsonPath('data.by_payment_method.other.total', 10)
        ->assertJsonPath('data.by_payment_method.cash.total', 5);
});

// Money charged but not collected yet ("Cobrar al retirar") lands in
// total_revenue with no payment_method, so without its own figure the caja
// tiles silently under-report the day.
test('the daily summary reports what is still uncollected', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $cr = ClientResourceModel::factory()->create(['tenant_id' => $tenant->id, 'client_id' => $user->id, 'type' => 'sedan']);
    TenantUserModel::create(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => 'owner', 'is_active' => true]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    $make = function (array $attrs) use ($tenant, $cr, $service, $user) {
        $cobradoCon = $attrs['payment_status'] === 'paid' ? $attrs['payment_method'] : null;
        $log = ServiceLogModel::factory()->create(
            ['payment_method' => null, 'payment_status' => 'unpaid'] + $attrs + [
                'tenant_id' => $tenant->id, 'client_resource_id' => $cr->id, 'service_id' => $service->id,
                'attended_by' => $user->id, 'created_by' => $user->id, 'log_date' => now()->toDateString(),
            ]
        );
        if ($cobradoCon !== null) {
            cobrar($log, $cobradoCon, $user->id);
        }
    };

    // Collected: 36 + 36 = 72
    $make(['payment_method' => 'cash', 'payment_status' => 'paid', 'price_charged' => 36.00]);
    $make(['payment_method' => 'transfer', 'payment_status' => 'paid', 'price_charged' => 36.00]);
    // Pending at pickup: 45 + 12 + 52 = 109, no method picked yet
    $make(['payment_method' => null, 'payment_status' => 'unpaid', 'price_charged' => 45.00]);
    $make(['payment_method' => null, 'payment_status' => 'unpaid', 'price_charged' => 12.00]);
    $make(['payment_method' => null, 'payment_status' => 'unpaid', 'price_charged' => 52.00]);

    $res = $this->actingAs($user)->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/service-logs/summary?date=' . now()->toDateString());

    $res->assertOk()
        ->assertJsonPath('data.unpaid.total', 109)
        ->assertJsonPath('data.unpaid.count', 3)
        // "Ingresos del día" shows money actually in the till.
        ->assertJsonPath('data.collected.total', 72)
        ->assertJsonPath('data.collected.count', 2)
        // total_revenue keeps meaning "everything registered today".
        ->assertJsonPath('data.total_revenue', 181)
        ->assertJsonPath('data.by_payment_method.cash.total', 36)
        ->assertJsonPath('data.by_payment_method.transfer.total', 36);
});

// Reservations carry their own payment_status and default to unpaid, so a
// frontend "total_revenue - unpaid" would bill an unpaid reservation as
// collected. Both figures have to split reservations too.
test('the collected and uncollected figures account for reservations', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id, 'price' => 25.00]);
    $cr = ClientResourceModel::factory()->create(['tenant_id' => $tenant->id, 'client_id' => $user->id, 'type' => 'sedan']);
    TenantUserModel::create(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => 'owner', 'is_active' => true]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    // One service log, collected.
    cobrar(ServiceLogModel::factory()->create([
        'tenant_id' => $tenant->id, 'client_resource_id' => $cr->id, 'service_id' => $service->id,
        'attended_by' => $user->id, 'created_by' => $user->id, 'payment_method' => null,
        'payment_status' => 'unpaid', 'price_charged' => 10.00, 'log_date' => now()->toDateString(),
    ]), 'cash', $user->id);

    // Two reservations at $25: one prepaid, one still to be paid at pickup.
    foreach (['paid', 'unpaid'] as $status) {
        \App\Infrastructure\Persistence\Models\ReservationModel::factory()->create([
            'tenant_id'          => $tenant->id,
            'client_id'          => $user->id,
            'client_resource_id' => $cr->id,
            'service_id'         => $service->id,
            'created_by'         => $user->id,
            'status'             => 'completed',
            'payment_status'     => $status,
            'scheduled_at'       => now(),
        ]);
    }

    $this->actingAs($user)->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/service-logs/summary?date=' . now()->toDateString())
        ->assertOk()
        // 10 (log) + 25 (prepaid reservation)
        ->assertJsonPath('data.collected.total', 35)
        ->assertJsonPath('data.collected.count', 2)
        // Only the reservation waiting to be paid
        ->assertJsonPath('data.unpaid.total', 25)
        ->assertJsonPath('data.unpaid.count', 1)
        ->assertJsonPath('data.total_revenue', 60);
});

test('the daily summary reports zero uncollected when everything is paid', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $cr = ClientResourceModel::factory()->create(['tenant_id' => $tenant->id, 'client_id' => $user->id, 'type' => 'sedan']);
    TenantUserModel::create(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => 'owner', 'is_active' => true]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    cobrar(ServiceLogModel::factory()->create([
        'tenant_id' => $tenant->id, 'client_resource_id' => $cr->id, 'service_id' => $service->id,
        'attended_by' => $user->id, 'created_by' => $user->id, 'payment_method' => null,
        'payment_status' => 'unpaid', 'price_charged' => 20.00, 'log_date' => now()->toDateString(),
    ]), 'cash', $user->id);

    $this->actingAs($user)->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/service-logs/summary?date=' . now()->toDateString())
        ->assertOk()
        ->assertJsonPath('data.unpaid.total', 0)
        ->assertJsonPath('data.unpaid.count', 0)
        ->assertJsonPath('data.collected.total', 20);
});
