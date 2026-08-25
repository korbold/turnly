<?php

declare(strict_types=1);

namespace App\Domain\Cash;

use RuntimeException;

/**
 * Las reglas de la caja son del dominio, no del controlador: el mismo "no
 * se puede abrir dos veces" tiene que valer si mañana la caja se abre desde un
 * comando o desde la app móvil. El controlador traduce `errorCode` a JSON.
 */
class CashRegisterException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public static function alreadyOpen(string $date): self
    {
        return new self('ALREADY_OPEN', "Ya hay una caja abierta para el {$date}.");
    }

    public static function previousSessionOpen(string $date): self
    {
        return new self(
            'PREVIOUS_SESSION_OPEN',
            "La caja del {$date} sigue abierta. Ciérrala antes de abrir la de hoy."
        );
    }

    public static function sessionClosed(): self
    {
        return new self('SESSION_CLOSED', 'Esta caja ya está cerrada y no se puede modificar.');
    }

    /** Reabrir sólo tiene sentido sobre una caja cerrada. */
    public static function sessionAlreadyOpen(): self
    {
        return new self('SESSION_ALREADY_OPEN', 'Esta caja ya está abierta.');
    }

    public static function invalidType(string $type): self
    {
        return new self('INVALID_TYPE', "Tipo de movimiento desconocido: {$type}.");
    }
}
