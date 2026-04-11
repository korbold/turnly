<?php

namespace App\Domain\WashLog\Entities;

final readonly class WashLog
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $vehicleId,
        public string $serviceId,
        public ?string $reservationId,
        public string $attendedBy,
        public string $createdBy,
        public \DateTimeImmutable $startedAt,
        public ?\DateTimeImmutable $finishedAt,
        public float $priceCharged,
        public string $paymentMethod,
        public string $status,
        public ?string $notes,
        public string $logDate,
    ) {}
}
