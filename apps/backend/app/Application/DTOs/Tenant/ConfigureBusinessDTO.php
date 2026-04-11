<?php

namespace App\Application\DTOs\Tenant;

final readonly class ConfigureBusinessDTO
{
    public function __construct(
        public string $tenantId,
        public ?array $settings = null,
        public ?int $onboardingStep = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            settings: $data['settings'] ?? null,
            onboardingStep: $data['onboarding_step'] ?? null,
        );
    }
}
