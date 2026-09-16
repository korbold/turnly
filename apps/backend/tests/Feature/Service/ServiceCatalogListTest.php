<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function catalogActor(TenantModel $tenant): UserModel {
    $user = UserModel::factory()->create();

    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $user->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    return $user;
}

it('lists a catalog larger than the default page size', function () {
    $tenant = TenantModel::factory()->create(['business_type' => 'car_wash']);
    $user   = catalogActor($tenant);

    // Every service keeps the default sort_order of 0, the way the UI creates them.
    for ($i = 1; $i <= 60; $i++) {
        ServiceModel::factory()->create([
            'tenant_id'  => $tenant->id,
            'name'       => sprintf('Servicio %02d', $i),
            'sort_order' => 0,
        ]);
    }

    $res = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/services?per_page=all');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(60);
});

it('paginates a catalog without dropping or repeating a service', function () {
    $tenant = TenantModel::factory()->create(['business_type' => 'car_wash']);
    $user   = catalogActor($tenant);

    for ($i = 1; $i <= 60; $i++) {
        ServiceModel::factory()->create([
            'tenant_id'  => $tenant->id,
            'name'       => sprintf('Servicio %02d', $i),
            'sort_order' => 0,
        ]);
    }

    $seen = [];
    foreach ([1, 2] as $page) {
        $res = $this->actingAs($user)
            ->withHeader('X-Tenant', $tenant->slug)
            ->getJson("/api/v1/services?page={$page}");

        $res->assertOk();
        $seen = array_merge($seen, array_column($res->json('data'), 'id'));
    }

    expect($seen)->toHaveCount(60);
    expect(array_unique($seen))->toHaveCount(60);
});

it('filters by name across the whole catalog, not just the page', function () {
    $tenant = TenantModel::factory()->create(['business_type' => 'car_wash']);
    $user   = catalogActor($tenant);

    for ($i = 1; $i <= 10; $i++) {
        ServiceModel::factory()->create([
            'tenant_id' => $tenant->id, 'name' => "Desmanche {$i}", 'sort_order' => 0,
        ]);
    }
    // Enough noise that the matches would fall off a 24-row page on their own.
    for ($i = 1; $i <= 50; $i++) {
        ServiceModel::factory()->create([
            'tenant_id' => $tenant->id, 'name' => sprintf('Lavada %02d', $i), 'sort_order' => 0,
        ]);
    }

    $res = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/services?q=Desmanche&per_page=24');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(10);
    expect($res->json('meta.total'))->toBe(10);
});

it('matches the description too, and ignores case', function () {
    $tenant = TenantModel::factory()->create(['business_type' => 'car_wash']);
    $user   = catalogActor($tenant);

    ServiceModel::factory()->create([
        'tenant_id' => $tenant->id, 'name' => 'Encerada', 'description' => 'Incluye pulida de vidrios',
    ]);
    ServiceModel::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Chasis', 'description' => null]);

    $res = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/services?q=PULIDA');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(1);
    expect($res->json('data.0.name'))->toBe('Encerada');
});

it('honours the page size the list asks for', function () {
    $tenant = TenantModel::factory()->create(['business_type' => 'car_wash']);
    $user   = catalogActor($tenant);

    for ($i = 1; $i <= 57; $i++) {
        ServiceModel::factory()->create([
            'tenant_id' => $tenant->id, 'name' => sprintf('Servicio %02d', $i), 'sort_order' => 0,
        ]);
    }

    $res = $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/services?per_page=24&page=3');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(9);
    expect($res->json('meta.last_page'))->toBe(3);
    expect($res->json('meta.total'))->toBe(57);
});
