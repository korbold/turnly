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
        $clientResource = new ClientResource(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            clientId: $dto->clientId,
            data: $dto->data,
        );

        return $this->clientResourceRepository->save($clientResource);
    }
}
