<?php

namespace App\Domain\Reservation\Contracts;

use App\Domain\Reservation\Entities\Reservation;
use App\Domain\Reservation\Enums\ReservationStatus;

interface ReservationRepositoryInterface
{
    public function findById(string $id): ?Reservation;
    public function findByTenantAndDate(string $tenantId, string $date): array;
    public function findConflicting(string $tenantId, \DateTimeImmutable $start, \DateTimeImmutable $end, ?string $excludeId = null): array;
    public function save(Reservation $reservation): Reservation;
    public function updateStatus(string $id, ReservationStatus $status, ?string $cancelReason = null): void;
    public function paginate(int $perPage = 15, array $filters = []): array;
}
