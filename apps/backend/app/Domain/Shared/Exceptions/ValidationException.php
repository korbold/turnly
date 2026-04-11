<?php

namespace App\Domain\Shared\Exceptions;

class ValidationException extends AppException
{
    public function __construct(string $message = 'Validation error')
    {
        parent::__construct($message);
    }

    public function getErrorCode(): string
    {
        return 'VALIDATION_ERROR';
    }

    public function getStatusCode(): int
    {
        return 422;
    }
}
