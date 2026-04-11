<?php

namespace App\Application\DTOs\Tenant;

final readonly class RegisterTenantDTO
{
    public function __construct(
        public string $name,
        public string $slug,
        public string $ownerName,
        public string $email,
        public string $password,
        public ?string $phone = null,
        public ?string $city = null,
        public string $country = 'EC',
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            name: $data['name'],
            slug: $data['slug'],
            ownerName: $data['owner_name'],
            email: $data['email'],
            password: $data['password'],
            phone: $data['phone'] ?? null,
            city: $data['city'] ?? null,
            country: $data['country'] ?? 'EC',
        );
    }
}
