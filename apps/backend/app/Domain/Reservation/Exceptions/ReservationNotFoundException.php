<?php

namespace App\Domain\Reservation\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

class ReservationNotFoundException extends AppException
{
    public function __construct(string $id = '')
    {
        parent::__construct("Reservation not found: {$id}");
    }

    public function getErrorCode(): string
    {
        return 'RESERVATION_NOT_FOUND';
    }

    public function getStatusCode(): int
    {
        return 404;
    }
}
