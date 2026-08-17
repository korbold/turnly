<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->cashier = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cashier->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $client = UserModel::factory()->create(['name' => 'Federman Paspuel']);
    $this->hilux = ClientResourceModel::create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $client->id,
        'data' => ['plate' => 'IBB9762', 'brand' => 'Toyota', 'model' => 'Hilux'],
    ]);
    $this->tracker = ClientResourceModel::create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $client->id,
        'data' => ['plate' => 'IBB7067', 'brand' => 'Chevrolet', 'model' => 'Tracker'],
    ]);

    $this->makeLog = function (ClientResourceModel $cr, array $attrs) {
        return ServiceLogModel::factory()->create($attrs + [
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $cr->id,
            'service_id' => $this->service->id,
            'attended_by' => $this->cashier->id,
            'created_by' => $this->cashier->id,
            'log_date' => now()->toDateString(),
        ]);
    };
});

function fetchLogs(array $query = [])
{
    return test()
        ->actingAs(test()->cashier)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->getJson('/api/v1/service-logs?' . http_build_query($query));
}

test('filters by payment state', function () {
    ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    ($this->makeLog)($this->tracker, ['payment_method' => null, 'payment_status' => 'unpaid']);

    fetchLogs(['payment' => 'paid'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs(['payment' => 'pending'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs()->assertOk()->assertJsonCount(2, 'data');
});

test('filters by payment method', function () {
    ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    ($this->makeLog)($this->tracker, ['payment_method' => 'transfer', 'payment_status' => 'paid']);

    fetchLogs(['payment' => 'cash'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs(['payment' => 'transfer'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs(['payment' => 'card'])->assertOk()->assertJsonCount(0, 'data');
});

test('filters by service status', function () {
    ($this->makeLog)($this->hilux, ['status' => 'in_progress', 'payment_status' => 'paid', 'payment_method' => 'cash']);
    ($this->makeLog)($this->tracker, ['status' => 'completed', 'payment_status' => 'paid', 'payment_method' => 'cash']);

    fetchLogs(['status' => 'in_progress'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs(['status' => 'completed'])->assertOk()->assertJsonCount(1, 'data');
});

// The plate lives inside the client_resources `data` JSON column, which MySQL
// compares with a binary collation — a plain LIKE would only match the exact
// case it was stored in.
test('searches the plate in any case', function (string $term) {
    ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    ($this->makeLog)($this->tracker, ['payment_method' => 'cash', 'payment_status' => 'paid']);

    fetchLogs(['q' => $term])
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.client_resource.data.plate', 'IBB9762');
})->with([
    'uppercase' => ['IBB9762'],
    'lowercase' => ['ibb9762'],
    'partial lowercase' => ['ibb97'],
]);

test('searches the brand and the owner name in any case', function (string $term) {
    ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);

    fetchLogs(['q' => $term])->assertOk()->assertJsonCount(1, 'data');
})->with([
    'brand lowercase' => ['toyota'],
    'brand uppercase' => ['TOYOTA'],
    'owner name' => ['federman'],
]);

test('returns nothing when the search matches no row', function () {
    ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);

    fetchLogs(['q' => 'zzz999'])->assertOk()->assertJsonCount(0, 'data');
});

test('combines the payment filter with the search', function () {
    ($this->makeLog)($this->hilux, ['payment_method' => null, 'payment_status' => 'unpaid']);
    ($this->makeLog)($this->tracker, ['payment_method' => 'cash', 'payment_status' => 'paid']);

    fetchLogs(['payment' => 'pending', 'q' => 'toyota'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs(['payment' => 'paid', 'q' => 'toyota'])->assertOk()->assertJsonCount(0, 'data');
});

test('keeps filtering to the requested day', function () {
    ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    ($this->makeLog)($this->tracker, [
        'payment_method' => 'cash', 'payment_status' => 'paid',
        'log_date' => now()->subDay()->toDateString(),
    ]);

    fetchLogs(['payment' => 'paid'])->assertOk()->assertJsonCount(1, 'data');
    fetchLogs(['date' => now()->subDay()->toDateString()])->assertOk()->assertJsonCount(1, 'data');
});

test('paginates with the requested page size', function () {
    foreach (range(1, 12) as $i) {
        ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    }

    fetchLogs(['per_page' => 10])
        ->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta.total', 12)
        ->assertJsonPath('meta.per_page', 10)
        ->assertJsonPath('meta.last_page', 2);

    fetchLogs(['per_page' => 10, 'page' => 2])
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.current_page', 2);
});

test('per_page=all returns every row on a single page', function () {
    foreach (range(1, 12) as $i) {
        ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    }

    fetchLogs(['per_page' => 'all'])
        ->assertOk()
        ->assertJsonCount(12, 'data')
        ->assertJsonPath('meta.total', 12)
        ->assertJsonPath('meta.last_page', 1);
});

test('per_page=all is still bounded by the active filters', function () {
    ($this->makeLog)($this->hilux, ['payment_method' => null, 'payment_status' => 'unpaid']);
    ($this->makeLog)($this->tracker, ['payment_method' => 'cash', 'payment_status' => 'paid']);

    fetchLogs(['per_page' => 'all', 'payment' => 'pending'])
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 1);
});

test('per_page=all copes with a day that has no rows', function () {
    fetchLogs(['per_page' => 'all'])
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('rejects a page size that is not offered', function (string $size) {
    foreach (range(1, 3) as $i) {
        ($this->makeLog)($this->hilux, ['payment_method' => 'cash', 'payment_status' => 'paid']);
    }

    // Falls back to the default rather than letting a caller ask for 10000.
    fetchLogs(['per_page' => $size])->assertOk()->assertJsonPath('meta.per_page', 50);
})->with(['garbage' => ['abc'], 'oversized' => ['10000'], 'zero' => ['0']]);
