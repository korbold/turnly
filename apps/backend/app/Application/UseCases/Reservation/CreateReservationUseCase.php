<?php

namespace App\Application\UseCases\Reservation;

use App\Application\DTOs\Reservation\CreateReservationDTO;
use App\Domain\BusinessResource\Exceptions\NoResourceAvailableException;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Entities\Reservation;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\OutsideBusinessHoursException;
use App\Domain\Reservation\Exceptions\ReservationConflictException;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Notifications\Notifications\NewReservationForAdmin;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
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
        $slot = AvailabilitySlotModel::query()
            ->forTenant($dto->tenantId)
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

        // Auto-assign or use client-selected business resource
        $activeResources = BusinessResourceModel::where('tenant_id', $dto->tenantId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $businessResourceId = null;

        if ($activeResources->isNotEmpty()) {
            $allowClientSelection = (bool) ($tenant->settings['allow_client_resource_selection'] ?? false);

            if (!$allowClientSelection) {
                $assigned = $activeResources->first(function ($resource) use ($scheduledAt, $estimatedEnd) {
                    return !ReservationModel::where('business_resource_id', $resource->id)
                        ->where('scheduled_at', '<', $estimatedEnd->format('Y-m-d H:i:s'))
                        ->where('estimated_end', '>', $scheduledAt->format('Y-m-d H:i:s'))
                        ->whereNotIn('status', ['cancelled', 'no_show'])
                        ->exists();
                });

                if (!$assigned) {
                    throw new NoResourceAvailableException();
                }

                $businessResourceId = $assigned->id;
            } else {
                $businessResourceId = $dto->businessResourceId;
            }
        }

        $reservation = new Reservation(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            clientId: $dto->clientId,
            clientResourceId: $dto->clientResourceId,
            businessResourceId: $businessResourceId,
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

        $saved = $this->reservationRepository->save($reservation);

        // Notify tenant admins about new reservation
        try {
            $model = ReservationModel::with(['service', 'client', 'tenant'])->find($saved->id);
            if ($model) {
                $admins = TenantModel::find($saved->tenantId)
                    ?->users()
                    ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
                    ->wherePivot('is_active', true)
                    ->get();

                if ($admins && $admins->isNotEmpty()) {
                    Notification::send($admins, new NewReservationForAdmin($model));
                }
            }
        } catch (\Throwable $e) {
            Log::error('Failed to send new reservation notification', ['error' => $e->getMessage()]);
        }

        return $saved;
    }
}
