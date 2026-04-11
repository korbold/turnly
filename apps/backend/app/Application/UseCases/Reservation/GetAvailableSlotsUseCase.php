<?php

namespace App\Application\UseCases\Reservation;

use App\Application\DTOs\Reservation\AvailableSlotsQueryDTO;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ServiceModel;

class GetAvailableSlotsUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
    ) {}

    public function execute(AvailableSlotsQueryDTO $dto): array
    {
        $date = new \DateTimeImmutable($dto->date);
        $dayOfWeek = (int) $date->format('N') - 1; // 0=Monday

        // Get service duration
        $service = ServiceModel::withoutGlobalScopes()->findOrFail($dto->serviceId);
        $durationMinutes = $service->duration_minutes;

        // Get availability slots for this day
        $availabilitySlots = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $dto->tenantId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($availabilitySlots->isEmpty()) {
            return [];
        }

        // Get existing reservations for the date
        $existingReservations = $this->reservationRepository->findByTenantAndDate($dto->tenantId, $dto->date);

        $slots = [];

        foreach ($availabilitySlots as $availability) {
            $startTime = new \DateTimeImmutable($dto->date . ' ' . $availability->start_time);
            $endTime = new \DateTimeImmutable($dto->date . ' ' . $availability->end_time);
            $maxConcurrent = $availability->max_concurrent;

            // Generate time intervals
            $current = $startTime;
            while ($current->modify("+{$durationMinutes} minutes") <= $endTime) {
                $slotEnd = $current->modify("+{$durationMinutes} minutes");

                // Count overlapping reservations
                $overlapping = 0;
                foreach ($existingReservations as $reservation) {
                    $resStart = $reservation->scheduledAt;
                    $resEnd = $reservation->estimatedEnd;

                    if ($current < $resEnd && $slotEnd > $resStart) {
                        $overlapping++;
                    }
                }

                if ($overlapping < $maxConcurrent) {
                    $slots[] = [
                        'start' => $current->format('Y-m-d H:i:s'),
                        'end' => $slotEnd->format('Y-m-d H:i:s'),
                        'available' => $maxConcurrent - $overlapping,
                    ];
                }

                $current = $current->modify('+30 minutes'); // 30-min interval grid
            }
        }

        return $slots;
    }
}
