<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'business_type' => 'barbershop',
        'custom_fields' => [
            ['key' => 'nombre', 'label' => 'Nombre', 'type' => 'text', 'required' => false, 'options' => null, 'capitalize' => 'capitalize'],
            ['key' => 'telefono', 'label' => 'Teléfono', 'type' => 'text', 'required' => false, 'options' => null],
        ],
    ]);

    // The logged-in cashier is the tenant owner (staff role).
    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

// Regression: an admin registering a walk-in via "Nuevo cliente" (name in the
// `nombre` custom field, no client_id) had the resource saved with the admin's
// OWN staff user id, then the browse staff-exclusion filter hid it — the POST
// succeeded (toast) but the client never appeared in the list.
test('admin-created walk-in appears in the browse clients list', function () {
    $create = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'data' => ['nombre' => 'Juan Pérez', 'telefono' => '0999280376'],
        ]);

    $create->assertStatus(201);

    $list = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources?all=1');

    $list->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.client.name', 'Juan Pérez');
});

// Regression: car-wash tenants whose custom_fields carry no name field (only
// placa/marca/color/tipo) fell back to the cashier's own staff id, so every
// walk-in vanished from Clientes. Unowned keeps it visible.
test('walk-in with no name field is saved unowned and still lists', function () {
    $this->tenant->update(['custom_fields' => [
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null, 'capitalize' => 'uppercase'],
        ['key' => 'brand', 'label' => 'Marca', 'type' => 'text', 'required' => false, 'options' => null],
    ]]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $create = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'data' => ['plate' => 'IAI3592', 'brand' => 'JMC'],
        ]);

    $create->assertStatus(201)->assertJsonPath('client_id', null);

    $list = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources?all=1');

    $list->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.label', 'IAI3592 - JMC');
});

// The walk-in form asks for a name even when the tenant configured no name
// field, shipping it under the conventional `nombre` key. Reading only the
// configured custom_fields would drop it on the floor.
test('name typed for a tenant without a name field still creates the client', function () {
    $this->tenant->update(['custom_fields' => [
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null, 'capitalize' => 'uppercase'],
    ]]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'data' => ['plate' => 'IAI3592', 'nombre' => 'Marta Ruiz'],
        ])
        ->assertStatus(201);

    $list = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources?all=1');

    $list->assertOk()->assertJsonPath('data.0.client.name', 'Marta Ruiz');
});

// "Asignar nombre" on an unowned record: PATCH with a name links (or
// creates) the client so the row stops being anonymous.
test('naming an unowned walk-in later links a real client', function () {
    $this->tenant->update(['custom_fields' => [
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null, 'capitalize' => 'uppercase'],
    ]]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $created = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', ['data' => ['plate' => 'IAI3592']]);

    $created->assertStatus(201)->assertJsonPath('client_id', null);
    $id = $created->json('id');

    $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/client-resources/{$id}", [
            'data' => ['plate' => 'IAI3592', 'nombre' => 'Marta Ruiz'],
        ])
        ->assertOk()
        ->assertJsonPath('client.name', 'Marta Ruiz');

    expect(\App\Infrastructure\Persistence\Models\ClientResourceModel::find($id)->client_id)->not->toBeNull();
});

// The razón social the cashier types in "Datos de facturación" is a real
// person's name, so it names the client when no custom field does.
test('billing legal_name names the client when no name field exists', function () {
    $this->tenant->update(['custom_fields' => [
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null, 'capitalize' => 'uppercase'],
    ]]);
    app()->instance('current_tenant', $this->tenant->fresh());

    $create = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson('/api/v1/client-resources', [
            'data' => ['plate' => 'IAI3592'],
            'billing_profile' => [
                'doc_type'   => 'cedula',
                'doc_number' => '1004296905',
                'legal_name' => 'Vanessa Paspuel',
                'email'      => 'vane@example.com',
            ],
        ]);

    $create->assertStatus(201);

    $list = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources?all=1');

    $list->assertOk()->assertJsonPath('data.0.client.name', 'Vanessa Paspuel');
});
