<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;
use App\Events\ReservationUpdated;
use App\Infrastructure\Notifications\Notifications\ReservationStarted;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserModel;

class StartWashUseCase
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

        if (!$reservation->status->canTransitionTo(ReservationStatus::InProgress)) {
            throw new InvalidStatusTransitionException($reservation->status, ReservationStatus::InProgress);
        }

        $this->reservationRepository->updateStatus($reservationId, ReservationStatus::InProgress);

        // Notify client + broadcast realtime update
        try {
            $model = ReservationModel::with(['service', 'tenant'])->find($reservationId);
            if ($model) {
                ReservationUpdated::dispatch($model);
            }
            $client = $model ? UserModel::find($model->client_id) : null;
            if ($client && $model) {
                $client->notify(new ReservationStarted($model));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send reservation started notification', ['error' => $e->getMessage()]);
        }
    }
}
