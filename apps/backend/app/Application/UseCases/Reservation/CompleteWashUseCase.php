<?php

namespace App\Application\UseCases\Reservation;

use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\Exceptions\InvalidStatusTransitionException;
use App\Domain\Reservation\Exceptions\ReservationNotFoundException;
use App\Events\ReservationUpdated;
use App\Infrastructure\Notifications\Notifications\ReservationCompleted;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserModel;

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
        $model = ReservationModel::with(['service', 'tenant'])->find($reservationId);
        if ($model) {
            ReservationUpdated::dispatch($model);
            $this->consumption->applyForReservation($model);

            // Tell the customer the service is finished — push + in-app row.
            try {
                $client = UserModel::find($model->client_id);
                if ($client) {
                    $client->notify(new ReservationCompleted($model));
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Failed to send reservation completed notification', ['error' => $e->getMessage()]);
            }

            // Completing the wash no longer emits the invoice — billing happens
            // only when payment is recorded (see ReservationPaymentController).
            // This keeps one mental model: cobrar = facturar.
        }
    }
}
