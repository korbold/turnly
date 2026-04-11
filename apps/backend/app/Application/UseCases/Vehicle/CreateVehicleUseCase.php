<?php

namespace App\Application\UseCases\Vehicle;

use App\Application\DTOs\Vehicle\CreateVehicleDTO;
use App\Domain\Vehicle\Contracts\VehicleRepositoryInterface;
use App\Domain\Vehicle\Entities\Vehicle;
use Illuminate\Support\Str;

class CreateVehicleUseCase
{
    public function __construct(
        private VehicleRepositoryInterface $vehicleRepository,
    ) {}

    public function execute(CreateVehicleDTO $dto): Vehicle
    {
        // Check unique plate within tenant
        $existing = $this->vehicleRepository->findByPlate($dto->tenantId, $dto->plate);
        if ($existing) {
            throw new \App\Domain\Shared\Exceptions\ValidationException(
                'A vehicle with this plate already exists in this business'
            );
        }

        $vehicle = new Vehicle(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            ownerId: $dto->ownerId,
            plate: strtoupper($dto->plate),
            brand: $dto->brand,
            model: $dto->model,
            color: $dto->color,
            type: $dto->type,
        );

        return $this->vehicleRepository->save($vehicle);
    }
}
