<?php

namespace App\Domain\ServiceLog\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

final class ServiceLogNotFoundException extends AppException
{
    public function __construct()
    {
        parent::__construct('Service log not found', 404);
    }

    public function getErrorCode(): string
    {
        return 'SERVICE_LOG_NOT_FOUND';
    }

    public function getStatusCode(): int
    {
        return 404;
    }
}
