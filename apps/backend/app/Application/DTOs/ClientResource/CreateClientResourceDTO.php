<?php

namespace App\Application\DTOs\ClientResource;

final readonly class CreateClientResourceDTO
{
    public function __construct(
        public string $tenantId,
        public ?string $clientId,
        public ?array $data = null,
    ) {}
}
