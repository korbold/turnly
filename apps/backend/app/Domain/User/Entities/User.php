<?php

namespace App\Domain\User\Entities;

final readonly class User
{
    public function __construct(
        public string $id,
        public string $name,
        public string $email,
        public ?string $phone,
        public bool $isSuperAdmin,
    ) {}
}
