<?php

namespace App\Domain\Tenant\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

class TenantSuspendedException extends AppException
{
    public function __construct()
    {
        parent::__construct("This tenant is suspended");
    }

    public function getErrorCode(): string
    {
        return 'TENANT_SUSPENDED';
    }

    public function getStatusCode(): int
    {
        return 403;
    }
}
