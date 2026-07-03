<?php

namespace App\Application\DTOs\BusinessResource;

final readonly class BusinessResourceDTO
{
    public function __construct(
        public string $name,
        public ?string $description,
        public ?string $employeeId,
        public string $type,
        public bool $isActive,
        public int $sortOrder,
    ) {}
}
