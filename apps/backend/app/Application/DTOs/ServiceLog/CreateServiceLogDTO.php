<?php

namespace App\Application\DTOs\ServiceLog;

final readonly class CreateServiceLogDTO
{
    public function __construct(
        public string $tenantId,
        // Nullable: a counter sale is registered unattached when the
        // walk-in has no vehicle on file and only wants the product.
        public ?string $clientResourceId,
        // Nullable: a counter sale can be products only.
        public ?string $serviceId,
        public string $attendedBy,
        public string $createdBy,
        public float $priceCharged,
        // Nullable since Fase B — the cashier may defer cobro a la
        // entrega and skip the method until later.
        public ?string $paymentMethod = null,
        public ?string $reservationId = null,
        public ?string $notes = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            tenantId: $data['tenant_id'],
            clientResourceId: $data['client_resource_id'],
            serviceId: $data['service_id'],
            attendedBy: $data['attended_by'],
            createdBy: $data['created_by'],
            priceCharged: (float) $data['price_charged'],
            paymentMethod: $data['payment_method'] ?? null,
            reservationId: $data['reservation_id'] ?? null,
            notes: $data['notes'] ?? null,
        );
    }
}
