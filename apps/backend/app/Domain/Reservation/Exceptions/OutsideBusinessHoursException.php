<?php

namespace App\Domain\Reservation\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

final class OutsideBusinessHoursException extends AppException
{
    public function __construct()
    {
        parent::__construct('The requested time is outside business hours', 422);
    }

    public function getErrorCode(): string
    {
        return 'OUTSIDE_BUSINESS_HOURS';
    }

    public function getStatusCode(): int
    {
        return 422;
    }
}
