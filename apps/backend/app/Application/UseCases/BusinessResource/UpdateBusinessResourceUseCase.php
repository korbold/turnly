<?php

namespace App\Application\UseCases\BusinessResource;

use App\Application\DTOs\BusinessResource\BusinessResourceDTO;
use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;
use App\Domain\BusinessResource\Entities\BusinessResource;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateBusinessResourceUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $id, BusinessResourceDTO $dto): BusinessResource
    {
        $existing = $this->repo->findById($id);
        if (!$existing) {
            throw new HttpResponseException(response()->json(['message' => 'Resource not found'], 404));
        }

        $updated = new BusinessResource(
            id: $existing->id,
            tenantId: $existing->tenantId,
            name: $dto->name,
            description: $dto->description,
            employeeId: $dto->employeeId,
            type: $dto->type,
            isActive: $dto->isActive,
            sortOrder: $dto->sortOrder,
        );

        return $this->repo->save($updated);
    }
}
