<?php

namespace App\Application\UseCases\Reservation;

use App\Application\DTOs\Reservation\CreateReservationDTO;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Entities\Reservation;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\OutsideBusinessHoursException;
use App\Domain\Reservation\Exceptions\ReservationConflictException;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use Illuminate\Support\Str;

class CreateReservationUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
    ) {}

    public function execute(CreateReservationDTO $dto): Reservation
    {
        $scheduledAt = new \DateTimeImmutable($dto->scheduledAt);

        // Get service to calculate estimated_end
        $service = ServiceModel::withoutGlobalScopes()->findOrFail($dto->serviceId);
        $estimatedEnd = $scheduledAt->modify("+{$service->duration_minutes} minutes");

        // Check business hours
        $dayOfWeek = (int) $scheduledAt->format('N') - 1; // 0=Monday
        $slot = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $dto->tenantId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->where('start_time', '<=', $scheduledAt->format('H:i:s'))
            ->where('end_time', '>=', $estimatedEnd->format('H:i:s'))
            ->first();

        if (!$slot) {
            throw new OutsideBusinessHoursException();
        }

        // Check conflicts (max concurrent)
        $conflicts = $this->reservationRepository->findConflicting(
            $dto->tenantId,
            $scheduledAt,
            $estimatedEnd,
        );

        if (count($conflicts) >= $slot->max_concurrent) {
            throw new ReservationConflictException();
        }

        $reservation = new Reservation(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            clientId: $dto->clientId,
            vehicleId: $dto->vehicleId,
            serviceId: $dto->serviceId,
            assignedTo: $dto->assignedTo,
            scheduledAt: $scheduledAt,
            estimatedEnd: $estimatedEnd,
            status: ReservationStatus::Pending,
            notes: $dto->notes,
            cancelledAt: null,
            cancelReason: null,
            createdBy: $dto->createdBy,
        );

        return $this->reservationRepository->save($reservation);
    }
}
