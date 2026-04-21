<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;

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
    }
}
