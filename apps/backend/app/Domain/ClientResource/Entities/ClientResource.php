<?php

namespace App\Domain\ClientResource\Entities;

final readonly class ClientResource
{
    public function __construct(
        public string $id,
        public string $tenantId,
        // Nullable: a walk-in registered at the counter may have no
        // identified owner yet (staff never captured a name).
        public ?string $clientId,
        public ?array $data,
    ) {}
}
