<?php

namespace App\Application\UseCases\ClientResource;

use App\Application\DTOs\ClientResource\CreateClientResourceDTO;
use App\Domain\ClientResource\Contracts\ClientResourceRepositoryInterface;
use App\Domain\ClientResource\Entities\ClientResource;
use Illuminate\Support\Str;

class CreateClientResourceUseCase
{
    public function __construct(
        private ClientResourceRepositoryInterface $clientResourceRepository,
    ) {}

    public function execute(CreateClientResourceDTO $dto): ClientResource
    {
        // Check unique plate within tenant (if plate is provided)
        if (!empty($dto->plate)) {
            $existing = $this->clientResourceRepository->findByPlate($dto->tenantId, $dto->plate);
            if ($existing) {
                throw new \App\Domain\Shared\Exceptions\ValidationException(
                    'A resource with this plate already exists in this business'
                );
            }
        }

        $clientResource = new ClientResource(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            clientId: $dto->clientId,
            data: $dto->data,
            plate: strtoupper($dto->plate),
            brand: $dto->brand,
            model: $dto->model,
            color: $dto->color,
            type: $dto->type,
        );

        return $this->clientResourceRepository->save($clientResource);
    }
}
