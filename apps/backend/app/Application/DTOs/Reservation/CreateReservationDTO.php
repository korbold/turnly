<?php

namespace App\Application\DTOs\Reservation;

final readonly class CreateReservationDTO
{
    public function __construct(
        public string $tenantId,
        public string $clientId,
        public string $vehicleId,
        public string $serviceId,
        public string $scheduledAt,
        public string $createdBy,
        public ?string $assignedTo = null,
        public ?string $notes = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            clientId: $data['client_id'],
            vehicleId: $data['vehicle_id'],
            serviceId: $data['service_id'],
            scheduledAt: $data['scheduled_at'],
            createdBy: $data['created_by'],
            assignedTo: $data['assigned_to'] ?? null,
            notes: $data['notes'] ?? null,
        );
    }
}
