<?php

namespace App\Application\DTOs\Vehicle;

final readonly class CreateVehicleDTO
{
    public function __construct(
        public string $tenantId,
        public string $ownerId,
        public string $plate,
        public ?string $brand = null,
        public ?string $model = null,
        public ?string $color = null,
        public string $type = 'sedan',
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            ownerId: $data['owner_id'],
            plate: $data['plate'],
            brand: $data['brand'] ?? null,
            model: $data['model'] ?? null,
            color: $data['color'] ?? null,
            type: $data['type'] ?? 'sedan',
        );
    }
}
