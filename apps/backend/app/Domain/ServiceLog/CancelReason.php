<?php
// apps/backend/app/Domain/ServiceLog/CancelReason.php

declare(strict_types=1);

namespace App\Domain\ServiceLog;

/**
 * Por qué se anuló un registro del día.
 *
 * Lista cerrada por la misma razón que los motivos de precio: texto libre se
 * degrada a "error", "x", "prueba" en un mes y deja sin agrupar la única
 * pregunta que importa —¿por qué desaparecen tickets?—. Cuatro casos cubren lo
 * que pasa de verdad en un mostrador.
 *
 * @see \App\Domain\Pricing\PriceChangeReason
 */
final class CancelReason
{
    /** Se registró dos veces el mismo auto. El caso más común. */
    public const DUPLICADO = 'duplicado';
    /** Vehículo, servicio o precio mal cargados, y ya se rehízo aparte. */
    public const ERROR_CARGA = 'error_carga';
    /** El cliente se fue antes de que se hiciera el trabajo. */
    public const ARREPENTIDO = 'arrepentido';
    /** El único que exige nota escrita. */
    public const OTRO = 'otro';

    public const CODES = [
        self::DUPLICADO,
        self::ERROR_CARGA,
        self::ARREPENTIDO,
        self::OTRO,
    ];

    public const REQUIRES_NOTE = self::OTRO;

    private const LABELS = [
        self::DUPLICADO   => 'Duplicado',
        self::ERROR_CARGA => 'Error de carga',
        self::ARREPENTIDO => 'Cliente se arrepintió',
        self::OTRO        => 'Otro',
    ];

    public static function isValid(?string $code): bool
    {
        return $code !== null && in_array($code, self::CODES, true);
    }

    public static function label(?string $code): ?string
    {
        return $code === null ? null : (self::LABELS[$code] ?? null);
    }
}
