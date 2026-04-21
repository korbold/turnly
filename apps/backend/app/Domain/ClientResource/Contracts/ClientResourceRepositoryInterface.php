<?php

namespace App\Domain\ClientResource\Contracts;

use App\Domain\ClientResource\Entities\ClientResource;

interface ClientResourceRepositoryInterface
{
    public function findById(string $id): ?ClientResource;
    public function findByClient(string $clientId): array;
    public function save(ClientResource $clientResource): ClientResource;
    public function getHistory(string $clientResourceId): array;
    public function paginate(int $perPage = 15, array $filters = []): array;
}
