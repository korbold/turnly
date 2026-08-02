<?php

namespace App\Application\UseCases\Reservation;

use App\Application\DTOs\Reservation\AvailableSlotsQueryDTO;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\TenantModel;


class GetAvailableSlotsUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
    ) {}

    public function execute(AvailableSlotsQueryDTO $dto): array
    {
        $date = new \DateTimeImmutable($dto->date);
        $dayOfWeek = (int) $date->format('N') - 1; // 0=Monday

        $tenant = TenantModel::find($dto->tenantId);
        $step = (int) ($tenant?->settings['slot_duration_minutes'] ?? 30);
        $length = $dto->durationMinutes && $dto->durationMinutes > 0 ? (int) $dto->durationMinutes : $step;

        // Get availability slots for this day
        $availabilitySlots = AvailabilitySlotModel::query()
            ->forTenant($dto->tenantId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($availabilitySlots->isEmpty()) {
            return [];
        }

        // Get existing reservations for the date
        $existingReservations = $this->reservationRepository->findByTenantAndDate($dto->tenantId, $dto->date);

        if ($dto->businessResourceId !== null) {
            $existingReservations = array_values(array_filter(
                $existingReservations,
                fn ($r) => $r->businessResourceId === $dto->businessResourceId,
            ));
        }

        $slots = [];
        $now = new \DateTimeImmutable();
        $isToday = $date->format('Y-m-d') === $now->format('Y-m-d');

        foreach ($availabilitySlots as $availability) {
            $startTime = new \DateTimeImmutable($dto->date . ' ' . $availability->start_time);
            $endTime = new \DateTimeImmutable($dto->date . ' ' . $availability->end_time);
            $maxConcurrent = $dto->businessResourceId !== null ? 1 : $availability->max_concurrent;

            // Generate time intervals
            $current = $startTime;
            while ($current->modify("+{$length} minutes") <= $endTime) {
                $slotEnd = $current->modify("+{$length} minutes");

                // Skip past slots when date is today
                if ($isToday && $current < $now) {
                    $current = $current->modify("+{$step} minutes");
                    continue;
                }

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

                $current = $current->modify("+{$step} minutes");
            }
        }

        return $slots;
    }
}
