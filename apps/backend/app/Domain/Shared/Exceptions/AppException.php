<?php

namespace App\Domain\Shared\Exceptions;

use Exception;

abstract class AppException extends Exception
{
    abstract public function getErrorCode(): string;
    abstract public function getStatusCode(): int;

    public function getContext(): array
    {
        return [];
    }
}
