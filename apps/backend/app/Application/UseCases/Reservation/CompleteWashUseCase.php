<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;
use App\Infrastructure\Persistence\Models\ReservationModel;

class CompleteWashUseCase
{
    public function __construct(
        private ReservationRepositoryInterface $reservationRepository,
        private ConsumptionEngine $consumption,
    ) {}

    public function execute(string $reservationId): void
    {
        $reservation = $this->reservationRepository->findById($reservationId);

        if (!$reservation) {
            throw new ReservationNotFoundException($reservationId);
        }

        if (!$reservation->status->canTransitionTo(ReservationStatus::Completed)) {
            throw new InvalidStatusTransitionException($reservation->status, ReservationStatus::Completed);
        }

        $this->reservationRepository->updateStatus($reservationId, ReservationStatus::Completed);

        // Draw BOM-defined consumables now that the service is officially done.
        // The engine is idempotent, so it's safe to re-invoke if the controller
        // is retried.
        $model = ReservationModel::find($reservationId);
        if ($model) {
            $this->consumption->applyForReservation($model);
        }
    }
}
