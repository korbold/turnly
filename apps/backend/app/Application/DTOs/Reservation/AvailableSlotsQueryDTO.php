<?php

namespace App\Application\DTOs\Reservation;

final readonly class AvailableSlotsQueryDTO
{
    public function __construct(
        public string $tenantId,
        public string $date,
        public string $serviceId,
        public ?string $businessResourceId = null,
        public ?int $durationMinutes = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            date: $data['date'],
            serviceId: $data['service_id'],
            businessResourceId: $data['business_resource_id'] ?? null,
            durationMinutes: $data['duration_min'] ?? null,
        );
    }
}
