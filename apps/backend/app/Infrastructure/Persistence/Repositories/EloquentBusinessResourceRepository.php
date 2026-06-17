<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;

class EloquentBusinessResourceRepository implements BusinessResourceRepositoryInterface
{
    public function allForTenant(string $tenantId): array
    {
        return BusinessResourceModel::forTenant($tenantId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn ($m) => $this->toEntity($m))
            ->all();
    }

    public function findById(string $id): ?BusinessResource
    {
        $model = BusinessResourceModel::withoutGlobalScopes()->find($id);

        return $model ? $this->toEntity($model) : null;
    }

    public function save(BusinessResource $resource): BusinessResource
    {
        $model = BusinessResourceModel::withoutGlobalScopes()->updateOrCreate(
            ['id' => $resource->id],
            [
                'tenant_id'   => $resource->tenantId,
                'name'        => $resource->name,
                'description' => $resource->description,
                'employee_id' => $resource->employeeId,
                'type'        => $resource->type,
                'is_active'   => $resource->isActive,
                'sort_order'  => $resource->sortOrder,
            ]
        );

        return $this->toEntity($model->fresh());
    }

    public function delete(string $id): void
    {
        BusinessResourceModel::withoutGlobalScopes()->destroy($id);
    }

    private function toEntity(BusinessResourceModel $m): BusinessResource
    {
        return new BusinessResource(
            id: $m->id,
            tenantId: $m->tenant_id,
            name: $m->name,
            description: $m->description,
            employeeId: $m->employee_id,
            type: $m->type,
            isActive: $m->is_active,
            sortOrder: $m->sort_order,
        );
    }
}
