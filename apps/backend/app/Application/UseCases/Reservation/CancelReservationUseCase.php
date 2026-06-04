<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;
use App\Events\ReservationUpdated;
use App\Infrastructure\Notifications\Notifications\ReservationCancelled;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Notification;

class CancelReservationUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
    ) {}

    public function execute(string $reservationId, ?string $reason = null): void
    {
        $reservation = $this->reservationRepository->findById($reservationId);

        if (!$reservation) {
            throw new ReservationNotFoundException($reservationId);
        }

        if (!$reservation->status->canTransitionTo(ReservationStatus::Cancelled)) {
            throw new InvalidStatusTransitionException($reservation->status, ReservationStatus::Cancelled);
        }

        $tenant = TenantModel::find($reservation->tenantId);
        $cancellationHours = $tenant?->settings['cancellation_hours'] ?? 1;

        if ($cancellationHours > 0) {
            $now = new \DateTimeImmutable();
            $diffMinutes = ($reservation->scheduledAt->getTimestamp() - $now->getTimestamp()) / 60;
            if ($diffMinutes < ($cancellationHours * 60)) {
                $label = $cancellationHours == 1 ? '1 hora' : "$cancellationHours horas";
                throw new \App\Domain\Shared\Exceptions\ValidationException(
                    "Solo puedes cancelar con al menos $label de anticipación"
                );
            }
        }

        $this->reservationRepository->updateStatus($reservationId, ReservationStatus::Cancelled, $reason);

        // Notify both client and tenant admins
        try {
            $model = ReservationModel::with(['service', 'client', 'tenant'])->find($reservationId);
            if ($model) {
                ReservationUpdated::dispatch($model);
                $notification = new ReservationCancelled($model);

                // Notify client
                $client = UserModel::find($model->client_id);
                if ($client) {
                    $client->notify($notification);
                }

                // Notify tenant admins
                $admins = TenantModel::find($model->tenant_id)
                    ?->users()
                    ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
                    ->wherePivot('is_active', true)
                    ->where('users.id', '!=', $model->client_id)
                    ->get();

                if ($admins && $admins->isNotEmpty()) {
                    Notification::send($admins, $notification);
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send reservation cancelled notification', ['error' => $e->getMessage()]);
        }
    }
}
