<?php

namespace App\Domain\ClientResource\Entities;

final readonly class ClientResource
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $clientId,
        public ?array $data,
        public string $plate,
        public ?string $brand,
        public ?string $model,
        public ?string $color,
        public string $type,
    ) {}
}
