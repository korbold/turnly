<?php

namespace App\Application\UseCases\Vehicle;

use App\Domain\Vehicle\Contracts\VehicleRepositoryInterface;

class GetVehicleHistoryUseCase
{
    public function __construct(
        private VehicleRepositoryInterface $vehicleRepository,
    ) {}

    public function execute(string $vehicleId): array
    {
        return $this->vehicleRepository->getHistory($vehicleId);
    }
}
