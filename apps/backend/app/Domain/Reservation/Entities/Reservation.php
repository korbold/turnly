<?php

namespace App\Domain\Reservation\Entities;

use App\Domain\Reservation\Enums\ReservationStatus;

final readonly class Reservation
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $clientId,
        public ?string $clientResourceId,
        public string $serviceId,
        public ?string $assignedTo,
        public \DateTimeImmutable $scheduledAt,
        public \DateTimeImmutable $estimatedEnd,
        public ReservationStatus $status,
        public ?string $notes,
        public ?\DateTimeImmutable $cancelledAt,
        public ?string $cancelReason,
        public string $createdBy,
    ) {}
}
