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
