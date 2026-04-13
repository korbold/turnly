<?php

namespace App\Application\DTOs\ClientResource;

final readonly class CreateClientResourceDTO
{
    public function __construct(
        public string $tenantId,
        public string $clientId,
        public ?array $data = null,
        public string $plate = '',
        public ?string $brand = null,
        public ?string $model = null,
        public ?string $color = null,
        public string $type = 'sedan',
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            clientId: $data['client_id'],
            data: $data['data'] ?? null,
            plate: $data['plate'] ?? '',
            brand: $data['brand'] ?? null,
            model: $data['model'] ?? null,
            color: $data['color'] ?? null,
            type: $data['type'] ?? 'sedan',
        );
    }
}
