<?php

namespace App\Domain\Reservation\Exceptions;

use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Shared\Exceptions\AppException;

final class InvalidStatusTransitionException extends AppException
{
    public function __construct(ReservationStatus $from, ReservationStatus $to)
    {
        parent::__construct("Cannot transition from {$from->value} to {$to->value}", 422);
    }

    public function getErrorCode(): string
    {
        return 'INVALID_STATUS_TRANSITION';
    }

    public function getStatusCode(): int
    {
        return 422;
    }
}
