<?php

use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status'   => 'active',
        'slug'     => 'test-biz',
        'settings' => ['allow_client_resource_selection' => true],
    ]);
    TenantImageModel::create([
        'id'           => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'    => $this->tenant->id,
        'storage_path' => '/test.jpg',
        'url'          => 'https://example.com/test.jpg',
        'sort_order'   => 0,
    ]);
});

test('getTenant exposes allow_client_resource_selection setting', function () {
    $response = $this->getJson('/api/v1/public/tenants/test-biz');

    $response->assertOk()
        ->assertJsonPath('data.tenant.settings.allow_client_resource_selection', true);
});

test('getTenant exposes active business resources with employee', function () {
    $employee = UserModel::factory()->create(['name' => 'Juan Pérez']);

    BusinessResourceModel::create([
        'id'          => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'   => $this->tenant->id,
        'name'        => 'Silla Juan',
        'type'        => 'person',
        'employee_id' => $employee->id,
        'is_active'   => true,
        'sort_order'  => 0,
    ]);

    $response = $this->getJson('/api/v1/public/tenants/test-biz');

    $response->assertOk()
        ->assertJsonCount(1, 'data.business_resources')
        ->assertJsonPath('data.business_resources.0.name', 'Silla Juan')
        ->assertJsonPath('data.business_resources.0.type', 'person')
        ->assertJsonPath('data.business_resources.0.employee.name', 'Juan Pérez')
        ->assertJsonPath('data.business_resources.0.employee.photo_url', null);
});

test('getTenant excludes inactive resources', function () {
    BusinessResourceModel::create([
        'id'         => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id'  => $this->tenant->id,
        'name'       => 'Silla Inactiva',
        'type'       => 'physical',
        'is_active'  => false,
        'sort_order' => 0,
    ]);

    $response = $this->getJson('/api/v1/public/tenants/test-biz');

    $response->assertOk()
        ->assertJsonCount(0, 'data.business_resources');
});
