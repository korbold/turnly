<?php

namespace App\Domain\BusinessResource\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

final class NoResourceAvailableException extends AppException
{
    public function __construct()
    {
        parent::__construct('No hay recursos disponibles para ese horario', 409);
    }

    public function getErrorCode(): string
    {
        return 'NO_RESOURCE_AVAILABLE';
    }

    public function getStatusCode(): int
    {
        return 409;
    }
}
