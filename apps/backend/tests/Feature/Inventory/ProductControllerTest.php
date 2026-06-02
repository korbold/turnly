<?php

use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('can list products', function () {
    ProductModel::create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Shampoo',
        'type'      => 'consumable',
        'unit'      => 'ml',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/products');

    $response->assertOk()->assertJsonCount(1, 'data');
});

test('can create product', function () {
    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/products', [
            'sku'   => 'SH-001',
            'name'  => 'Shampoo Premium',
            'type'  => 'consumable',
            'unit'  => 'ml',
            'cost'  => 0.05,
            'price' => 0,
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.sku', 'SH-001')
        ->assertJsonPath('data.name', 'Shampoo Premium');
});

test('sku must be unique within tenant', function () {
    ProductModel::create([
        'tenant_id' => $this->tenant->id,
        'sku'       => 'DUP-1',
        'name'      => 'X',
        'type'      => 'consumable',
        'unit'      => 'u',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/products', [
            'sku'  => 'DUP-1',
            'name' => 'Other',
            'type' => 'consumable',
            'unit' => 'u',
        ]);

    $response->assertStatus(422);
});

test('can record a purchase via stock-movements endpoint', function () {
    $product = ProductModel::create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Aceite 5W30',
        'type'      => 'both',
        'unit'      => 'L',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/stock-movements', [
            'product_id' => $product->id,
            'type'       => 'purchase',
            'qty'        => 20,
            'unit_cost'  => 3.50,
        ]);

    $response->assertCreated();
    $this->assertDatabaseHas('product_stock_levels', [
        'product_id' => $product->id,
        'on_hand'    => 20,
    ]);
});

test('kardex returns recent movements for a product', function () {
    $product = ProductModel::create([
        'tenant_id' => $this->tenant->id,
        'name'      => 'Cera',
        'type'      => 'both',
        'unit'      => 'ml',
    ]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/stock-movements', [
            'product_id' => $product->id,
            'type'       => 'purchase',
            'qty'        => 500,
            'unit_cost'  => 0.01,
        ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/products/{$product->id}/movements");

    $response->assertOk()->assertJsonCount(1, 'data');
});
