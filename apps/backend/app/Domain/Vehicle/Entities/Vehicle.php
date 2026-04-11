<?php

namespace App\Domain\Vehicle\Entities;

final readonly class Vehicle
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $ownerId,
        public string $plate,
        public ?string $brand,
        public ?string $model,
        public ?string $color,
        public string $type,
    ) {}
}
