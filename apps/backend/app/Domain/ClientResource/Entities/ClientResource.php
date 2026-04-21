<?php

namespace App\Domain\ClientResource\Entities;

final readonly class ClientResource
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $clientId,
        public ?array $data,
    ) {}
}
