<?php

namespace App\Domain\Plan\Entities;

final readonly class Plan
{
    public function __construct(
        public string $id,
        public string $name,
        public string $slug,
        public float $price,
        public ?int $maxServices,
        public ?int $maxReservationsPerMonth,
        public ?int $maxEmployees,
        public bool $hasPushNotifications,
        public bool $hasReports,
        public bool $hasReminders,
        public bool $hasCustomPage,
        public bool $isActive,
        public int $sortOrder,
        public ?string $description,
    ) {}
}
