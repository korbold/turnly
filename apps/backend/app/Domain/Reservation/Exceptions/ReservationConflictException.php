<?php

namespace App\Domain\Reservation\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

final class ReservationConflictException extends AppException
{
    public function __construct()
    {
        parent::__construct('There is a scheduling conflict for this time slot', 409);
    }

    public function getErrorCode(): string
    {
        return 'RESERVATION_CONFLICT';
    }

    public function getStatusCode(): int
    {
        return 409;
    }
}
