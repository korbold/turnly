<?php

namespace App\Application\DTOs\WashLog;

final readonly class CreateWashLogDTO
{
    public function __construct(
        public string $tenantId,
        public string $vehicleId,
        public string $serviceId,
        public string $attendedBy,
        public string $createdBy,
        public float $priceCharged,
        public string $paymentMethod = 'cash',
        public ?string $reservationId = null,
        public ?string $notes = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            vehicleId: $data['vehicle_id'],
            serviceId: $data['service_id'],
            attendedBy: $data['attended_by'],
            createdBy: $data['created_by'],
            priceCharged: (float) $data['price_charged'],
            paymentMethod: $data['payment_method'] ?? 'cash',
            reservationId: $data['reservation_id'] ?? null,
            notes: $data['notes'] ?? null,
        );
    }
}
