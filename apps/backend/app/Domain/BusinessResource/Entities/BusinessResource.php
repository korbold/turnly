<?php

namespace App\Domain\BusinessResource\Entities;

final readonly class BusinessResource
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $name,
        public ?string $description,
        public ?string $employeeId,
        public string $type,
        public bool $isActive,
        public int $sortOrder,
    ) {}
}
