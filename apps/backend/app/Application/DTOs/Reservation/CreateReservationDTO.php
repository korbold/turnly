<?php

namespace App\Application\DTOs\Reservation;

final readonly class CreateReservationDTO
{
    public function __construct(
        public string $tenantId,
        public string $clientId,
        public ?string $clientResourceId,
        public string $serviceId,
        public string $scheduledAt,
        public string $createdBy,
        public ?string $assignedTo = null,
        public ?string $notes = null,
        public ?string $serviceVariantId = null,
        public ?string $businessResourceId = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            clientId: $data['client_id'],
            clientResourceId: $data['client_resource_id'] ?? null,
            serviceId: $data['service_id'],
            scheduledAt: $data['scheduled_at'],
            createdBy: $data['created_by'],
            assignedTo: $data['assigned_to'] ?? null,
            notes: $data['notes'] ?? null,
            serviceVariantId: $data['service_variant_id'] ?? null,
            businessResourceId: $data['business_resource_id'] ?? null,
        );
    }
}
