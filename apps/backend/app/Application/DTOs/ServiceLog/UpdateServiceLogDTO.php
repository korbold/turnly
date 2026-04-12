<?php

namespace App\Application\DTOs\ServiceLog;

final readonly class UpdateServiceLogDTO
{
    public function __construct(
        public string $id,
        public ?string $notes = null,
        public ?string $paymentMethod = null,
        public ?float $priceCharged = null,
    ) {}

    public static function fromArray(array $data): static
    {
        return new static(
            id: $data['id'],
            notes: $data['notes'] ?? null,
            paymentMethod: $data['payment_method'] ?? null,
            priceCharged: isset($data['price_charged']) ? (float) $data['price_charged'] : null,
        );
    }
}
