<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;
use App\Infrastructure\Notifications\Notifications\ReservationConfirmed;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserModel;

class ConfirmReservationUseCase
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

        if (!$reservation->status->canTransitionTo(ReservationStatus::Confirmed)) {
            throw new InvalidStatusTransitionException($reservation->status, ReservationStatus::Confirmed);
        }

        $this->reservationRepository->updateStatus($reservationId, ReservationStatus::Confirmed);

        // Notify client
        try {
            $model = ReservationModel::with(['service', 'tenant'])->find($reservationId);
            $client = $model ? UserModel::find($model->client_id) : null;
            if ($client && $model) {
                $client->notify(new ReservationConfirmed($model));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send reservation confirmed notification', ['error' => $e->getMessage()]);
        }
    }
}
