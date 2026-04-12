<?php

namespace App\Application\UseCases\ClientResource;

use App\Domain\ClientResource\Contracts\ClientResourceRepositoryInterface;

class GetClientResourceHistoryUseCase
{
    public function __construct(
        private ClientResourceRepositoryInterface $clientResourceRepository,
    ) {}

    public function execute(string $clientResourceId): array
    {
        return $this->clientResourceRepository->getHistory($clientResourceId);
    }
}
