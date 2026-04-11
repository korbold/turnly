<?php

namespace App\Domain\Tenant\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

class TenantNotFoundException extends AppException
{
    public function __construct(string $identifier = '')
    {
        parent::__construct("Tenant not found: {$identifier}");
    }

    public function getErrorCode(): string
    {
        return 'TENANT_NOT_FOUND';
    }

    public function getStatusCode(): int
    {
        return 404;
    }
}
