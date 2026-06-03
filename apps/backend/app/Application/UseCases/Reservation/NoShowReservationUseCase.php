<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;
use App\Infrastructure\Notifications\Notifications\ReservationNoShow;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserModel;

class NoShowReservationUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
    ) {}

    public function execute(string $reservationId): void
    {
        $reservation = $this->reservationRepository->findById($reservationId);

        if (!$reservation) {
            throw new ReservationNotFoundException($reservationId);
        }

        if (!$reservation->status->canTransitionTo(ReservationStatus::NoShow)) {
            throw new InvalidStatusTransitionException($reservation->status, ReservationStatus::NoShow);
        }

        $this->reservationRepository->updateStatus($reservationId, ReservationStatus::NoShow);

        // Let the customer know we logged a no-show so they can reschedule
        // and the change shows up in their in-app notifications inbox.
        try {
            $model = ReservationModel::with(['service', 'tenant'])->find($reservationId);
            $client = $model ? UserModel::find($model->client_id) : null;
            if ($client && $model) {
                $client->notify(new ReservationNoShow($model));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send reservation no-show notification', ['error' => $e->getMessage()]);
        }
    }
}
