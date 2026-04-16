<?php

namespace App\Application\UseCases\Reservation;

use App\Application\DTOs\Reservation\CreateReservationDTO;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Entities\Reservation;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\OutsideBusinessHoursException;
use App\Domain\Reservation\Exceptions\ReservationConflictException;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\TenantModel;

use Illuminate\Support\Str;

class CreateReservationUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
    ) {}

    public function execute(CreateReservationDTO $dto): Reservation
    {
        $scheduledAt = new \DateTimeImmutable($dto->scheduledAt);

        $tenant = TenantModel::find($dto->tenantId);
        $slotDuration = $tenant?->settings['slot_duration_minutes'] ?? 30;
        $estimatedEnd = $scheduledAt->modify("+{$slotDuration} minutes");

        // Convert to app timezone for business hours comparison
        $appTz = new \DateTimeZone(config('app.timezone', 'UTC'));
        $localScheduled = $scheduledAt->setTimezone($appTz);
        $localEnd = $estimatedEnd->setTimezone($appTz);

        // Check business hours
        $dayOfWeek = (int) $localScheduled->format('N') - 1; // 0=Monday
        $slot = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $dto->tenantId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->where('start_time', '<=', $localScheduled->format('H:i:s'))
            ->where('end_time', '>=', $localEnd->format('H:i:s'))
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
            clientResourceId: $dto->clientResourceId,
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
