<?php

namespace App\Domain\Vehicle\Contracts;

use App\Domain\Vehicle\Entities\Vehicle;

interface VehicleRepositoryInterface
{
    public function findById(string $id): ?Vehicle;
    public function findByPlate(string $tenantId, string $plate): ?Vehicle;
    public function findByOwner(string $ownerId): array;
    public function save(Vehicle $vehicle): Vehicle;
    public function getHistory(string $vehicleId): array;
    public function paginate(int $perPage = 15, array $filters = []): array;
}
