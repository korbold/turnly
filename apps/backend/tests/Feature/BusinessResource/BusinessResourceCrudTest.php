<?php

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(RefreshDatabase::class);

it('can create and retrieve a business resource', function () {
    $tenant = \App\Infrastructure\Persistence\Models\TenantModel::factory()->create();
    $repo = app(BusinessResourceRepositoryInterface::class);

    $resource = new BusinessResource(
        id: (string) \Illuminate\Support\Str::uuid(),
        tenantId: $tenant->id,
        name: 'Estación 1',
        description: null,
        employeeId: null,
        type: 'physical',
        isActive: true,
        sortOrder: 0,
    );

    $saved = $repo->save($resource);
    $found = $repo->findById($saved->id);

    expect($found)->not->toBeNull();
    expect($found->name)->toBe('Estación 1');
    expect($found->type)->toBe('physical');
});

it('lists only resources for the given tenant', function () {
    $tenantA = \App\Infrastructure\Persistence\Models\TenantModel::factory()->create();
    $tenantB = \App\Infrastructure\Persistence\Models\TenantModel::factory()->create();
    $repo = app(BusinessResourceRepositoryInterface::class);

    foreach (['Silla 1', 'Silla 2'] as $i => $name) {
        $repo->save(new BusinessResource(
            id: (string) \Illuminate\Support\Str::uuid(),
            tenantId: $tenantA->id,
            name: $name,
            description: null,
            employeeId: null,
            type: 'physical',
            isActive: true,
            sortOrder: $i,
        ));
    }

    $repo->save(new BusinessResource(
        id: (string) \Illuminate\Support\Str::uuid(),
        tenantId: $tenantB->id,
        name: 'Estación B',
        description: null,
        employeeId: null,
        type: 'physical',
        isActive: true,
        sortOrder: 0,
    ));

    $results = $repo->allForTenant($tenantA->id);

    expect($results)->toHaveCount(2);
    expect(collect($results)->pluck('name')->all())->toContain('Silla 1', 'Silla 2');
});
