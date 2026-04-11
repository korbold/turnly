<?php

namespace App\Domain\Tenant\Entities;

final readonly class Tenant
{
    public function __construct(
        public string $id,
        public string $slug,
        public string $name,
        public string $ownerName,
        public string $email,
        public ?string $phone,
        public ?string $city,
        public string $country,
        public string $plan,
        public string $status,
        public ?\DateTimeImmutable $trialEndsAt,
        public ?array $settings,
        public int $onboardingStep,
        public ?\DateTimeImmutable $activatedAt,
    ) {}

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    public function isTrialExpired(): bool
    {
        return $this->plan === 'trial'
            && $this->trialEndsAt !== null
            && $this->trialEndsAt < new \DateTimeImmutable();
    }
}
