<?php

declare(strict_types=1);

namespace App\Domain\Cash;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    /**
     * Se traduce sola a 422.
     *
     * Los controladores de caja la atrapan antes y la formatean igual; esto es
     * para los demás — cobrar un servicio, saldar una deuda, la app móvil —
     * donde nadie la esperaba y un 500 diría "se rompió el sistema" en vez de
     * "abre la caja".
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => $this->errorCode,
                'message' => $this->getMessage(),
            ],
        ], 422);
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

    /**
     * Cobrar en efectivo sin caja abierta. El mensaje nombra las dos salidas
     * porque quien lo lee tiene un cliente enfrente: abrirla, si todavía no
     * se abrió, o pedirle al dueño que la reabra.
     */
    public static function cashNeedsOpenTill(): self
    {
        return new self(
            'CASH_REQUIRES_OPEN_TILL',
            'Para cobrar en efectivo tiene que haber una caja abierta. Abre la caja del día, '
            . 'o pídele al dueño que reabra la que ya se cerró.'
        );
    }

    public static function invalidType(string $type): self
    {
        return new self('INVALID_TYPE', "Tipo de movimiento desconocido: {$type}.");
    }
}
