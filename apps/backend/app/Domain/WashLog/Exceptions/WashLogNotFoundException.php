<?php

namespace App\Domain\WashLog\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

final class WashLogNotFoundException extends AppException
{
    public function __construct()
    {
        parent::__construct('Wash log not found', 404);
    }

    public function getErrorCode(): string
    {
        return 'WASH_LOG_NOT_FOUND';
    }

    public function getStatusCode(): int
    {
        return 404;
    }
}
