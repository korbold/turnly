<?php

namespace App\Domain\BusinessResource\Contracts;

use App\Domain\BusinessResource\Entities\BusinessResource;

interface BusinessResourceRepositoryInterface
{
    /** @return BusinessResource[] */
    public function allForTenant(string $tenantId): array;

    public function findById(string $id): ?BusinessResource;

    public function save(BusinessResource $resource): BusinessResource;

    public function delete(string $id): void;
}
