<?php

namespace App\Domain\Tenant\Exceptions;

use App\Domain\Shared\Exceptions\AppException;

class TenantSlugTakenException extends AppException
{
    public function __construct(string $slug)
    {
        parent::__construct("The slug '{$slug}' is already taken");
    }

    public function getErrorCode(): string
    {
        return 'TENANT_SLUG_TAKEN';
    }

    public function getStatusCode(): int
    {
        return 422;
    }
}
