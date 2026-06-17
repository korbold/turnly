<?php

namespace App\Application\UseCases\BusinessResource;

use App\Application\DTOs\BusinessResource\BusinessResourceDTO;
use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use Illuminate\Support\Str;

class CreateBusinessResourceUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $tenantId, BusinessResourceDTO $dto): BusinessResource
    {
        $resource = new BusinessResource(
            id: (string) Str::uuid(),
            tenantId: $tenantId,
            name: $dto->name,
            description: $dto->description,
            employeeId: $dto->employeeId,
            type: $dto->type,
            isActive: $dto->isActive,
            sortOrder: $dto->sortOrder,
        );

        return $this->repo->save($resource);
    }
}
