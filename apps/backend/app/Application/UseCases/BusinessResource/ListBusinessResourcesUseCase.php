<?php

namespace App\Application\UseCases\BusinessResource;

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;

class ListBusinessResourcesUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $tenantId): array
    {
        return $this->repo->allForTenant($tenantId);
    }
}
