<?php

namespace App\Domain\ServiceLog\Entities;

final readonly class ServiceLog
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public ?string $clientResourceId,
        // Nullable: a counter sale can be products only.
        public ?string $serviceId,
        public ?string $reservationId,
        public string $attendedBy,
        public string $createdBy,
        public \DateTimeImmutable $startedAt,
        public ?\DateTimeImmutable $finishedAt,
        public float $priceCharged,
        // Nullable since Fase B — "cobrar al retirar" leaves the
        // method empty until the cashier registers the payment later.
        public ?string $paymentMethod,
        public string $status,
        public ?string $notes,
        public string $logDate,
    ) {}
}
