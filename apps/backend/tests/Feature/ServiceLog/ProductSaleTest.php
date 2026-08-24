<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\StockMovementModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);

    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'user_id'   => $this->user->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    $this->product = ProductModel::create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Aceite full sintético',
        'type'      => 'sellable',
        'unit'      => 'u',
        'cost'      => 20.00,
        'price'     => 45.00,
        'tax_rate'  => 15.00,
        'stock_min' => 0,
        'is_active' => true,
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

function postLog(array $items): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(test()->user)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => test()->clientResource->id,
            'attended_by'        => test()->user->id,
            'payment_method'     => 'cash',
            'items'              => $items,
        ]);
}

function productLine(float $qty = 1, float $price = 45.00): array
{
    return [
        'item_type'  => 'product',
        'product_id' => test()->product->id,
        'label'      => 'Aceite full sintético',
        'qty'        => $qty,
        'unit_price' => $price,
    ];
}

function serviceLine(float $price = 18.00): array
{
    return [
        'service_id' => test()->service->id,
        'label'      => 'Lavada Completa',
        'qty'        => 1,
        'unit_price' => $price,
    ];
}

// Counter sale: an aceite handed over without washing anything.
test('a product-only ticket is registered with no service', function () {
    $response = postLog([productLine(2)]);

    $response->assertStatus(201);

    $log = ServiceLogModel::find($response->json('data.id'));

    expect($log->service_id)->toBeNull()
        ->and((float) $log->price_charged)->toBe(90.0)
        ->and($log->items)->toHaveCount(1)
        ->and($log->items[0]->item_type)->toBe('product')
        ->and($log->items[0]->ref_id)->toBe($this->product->id);
});

test('selling a product leaves the kardex', function () {
    postLog([productLine(3)])->assertStatus(201);

    $movement = StockMovementModel::where('product_id', $this->product->id)->latest('id')->first();

    expect($movement)->not->toBeNull()
        ->and($movement->type)->toBe('sale')
        ->and((float) $movement->qty)->toBe(-3.0)
        ->and($movement->ref_type)->toBe('service_log');
});

test('a mixed ticket keeps the service as the primary one', function () {
    $response = postLog([serviceLine(), productLine()]);

    $response->assertStatus(201);

    $log = ServiceLogModel::find($response->json('data.id'));

    expect($log->service_id)->toBe($this->service->id)
        ->and((float) $log->price_charged)->toBe(63.0)
        ->and($log->items)->toHaveCount(2);
});

// The service line is listed second here: the primary service must be
// found by type, not by position.
test('a ticket that starts with a product still finds its service', function () {
    $response = postLog([productLine(), serviceLine()]);

    $log = ServiceLogModel::find($response->json('data.id'));

    expect($log->service_id)->toBe($this->service->id);
});

// The admin echoes service_id/product_id as explicit nulls on every
// line, so the rules have to tolerate them.
test('the admin payload shape with explicit nulls is accepted', function () {
    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => $this->clientResource->id,
            'attended_by'        => $this->user->id,
            'payment_method'     => 'cash',
            'service_id'         => null,
            'price_charged'      => 45.0,
            'items'              => [[
                'item_type'  => 'product',
                'service_id' => null,
                'product_id' => $this->product->id,
                'variant_id' => null,
                'label'      => 'Aceite full sintético',
                'qty'        => 1,
                'unit_price' => 45.0,
            ]],
        ])
        ->assertStatus(201);
});

test('a product line without a product is rejected', function () {
    postLog([[
        'item_type'  => 'product',
        'label'      => 'Sin producto',
        'qty'        => 1,
        'unit_price' => 10.00,
    ]])->assertStatus(422)->assertJsonValidationErrors('items.0.product_id');
});

// Editing a ticket twice would otherwise discount the same units again.
test('re-editing the items does not double-discount stock', function () {
    $id = postLog([productLine(2)])->json('data.id');

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$id}/items", ['items' => [productLine(2)]])
        ->assertOk();

    $net = (float) StockMovementModel::where('product_id', $this->product->id)->sum('qty');

    expect($net)->toBe(-2.0);
});

// A walk-in who only wants the aceite has no vehicle on file and wants
// no invoice. Forcing a client_resource_id made the cashier invent one,
// which is how tickets ended up filed under the staff member's own id.
function postAnonymousLog(array $items): \Illuminate\Testing\TestResponse
{
    return test()->actingAs(test()->user)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->postJson('/api/v1/service-logs', [
            'attended_by'    => test()->user->id,
            'payment_method' => 'cash',
            'items'          => $items,
        ]);
}

test('a counter sale is registered with no client resource', function () {
    $response = postAnonymousLog([productLine(2)]);

    $response->assertStatus(201);

    $log = ServiceLogModel::find($response->json('data.id'));

    expect($log->client_resource_id)->toBeNull()
        ->and($log->service_id)->toBeNull()
        ->and((float) $log->price_charged)->toBe(90.0)
        ->and($log->items)->toHaveCount(1);
});

// A service is rendered *on* something, so the vehicle stays mandatory
// there — only a products-only ticket may go unattached.
test('a ticket with a service still needs a client resource', function () {
    postAnonymousLog([serviceLine()])
        ->assertStatus(422)
        ->assertJsonValidationErrors('client_resource_id');
});

test('a mixed ticket still needs a client resource', function () {
    postAnonymousLog([productLine(), serviceLine()])
        ->assertStatus(422)
        ->assertJsonValidationErrors('client_resource_id');
});

// An explicit null is what the admin sends for a counter sale, so the
// rules have to read it the same as an absent key.
test('an explicit null client resource is accepted on a counter sale', function () {
    test()->actingAs(test()->user)
        ->withHeader('X-Tenant', test()->tenant->slug)
        ->postJson('/api/v1/service-logs', [
            'client_resource_id' => null,
            'attended_by'        => test()->user->id,
            'payment_method'     => 'cash',
            'items'              => [productLine()],
        ])
        ->assertStatus(201);
});

// The cents were always stored; the counter just never let anyone type
// them. Guard the sum so a future rounding "fix" can't eat them.
test('the ticket total keeps the cents', function () {
    $response = postLog([productLine(3, 4.25), serviceLine(18.50)]);

    $response->assertStatus(201);

    $log = ServiceLogModel::find($response->json('data.id'));

    expect((float) $log->price_charged)->toBe(31.25);
});

// The 500 this guards against needs MySQL to show itself: SQLite does not
// enforce the service_id foreign key, so assert the stored value instead
// of the status. A product id in service_logs.service_id is the corruption.
test('editing a product-only ticket leaves its service null', function () {
    $id = postLog([productLine(2)])->json('data.id');

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$id}/items", ['items' => [productLine(1, 7.05)]])
        ->assertOk();

    $log = ServiceLogModel::find($id);

    expect($log->service_id)->toBeNull()
        ->and((float) $log->price_charged)->toBe(7.05);
});

test('editing a mixed ticket keeps the service as the primary one', function () {
    $id = postLog([productLine(), serviceLine()])->json('data.id');

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [productLine(1, 4.25), serviceLine(9.99)],
        ])
        ->assertOk();

    $log = ServiceLogModel::find($id);

    expect($log->service_id)->toBe($this->service->id)
        ->and((float) $log->price_charged)->toBe(14.24);
});

// The corruption the admin caused: a product sent as a service line, so
// its uuid landed in service_logs.service_id and broke the foreign key
// with a 500. An unknown service id has to be a validation error, not a
// write the database refuses halfway.
test('a service line pointing at a product is rejected', function () {
    postLog([[
        'service_id' => test()->product->id,
        'label'      => 'Ambientador pino',
        'qty'        => 1,
        'unit_price' => 4.25,
    ]])->assertStatus(422)->assertJsonValidationErrors('items.0.service_id');
});

test('editing with a service line pointing at a product is rejected', function () {
    $id = postLog([productLine()])->json('data.id');

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$id}/items", ['items' => [[
            'service_id' => $this->product->id,
            'label'      => 'Ambientador pino',
            'qty'        => 1,
            'unit_price' => 4.25,
        ]]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('items.0.service_id');
});
