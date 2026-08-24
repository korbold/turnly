<?php
// apps/backend/app/Domain/ServiceLog/ServiceStaffing.php

declare(strict_types=1);

namespace App\Domain\ServiceLog;

/**
 * Qué personal lleva un servicio del catálogo, y por lo tanto qué se le exige
 * al registro antes de darlo por cerrado.
 *
 * Tres valores anidados y no dos banderas: si lleva secador lleva lavador, y
 * dos booleanos dejarían representar "secador sí, lavador no". Un cambio de
 * aceite no lo lava nadie; un lavado de chasis se lava y no se seca; una
 * lavada completa lleva los dos. Antes esto era una sola regla del rubro y era
 * falsa para la mayoría del catálogo.
 */
final class ServiceStaffing
{
    /** Nadie: no es un trabajo de lavado. Cambio de aceite, filtros. */
    public const NONE = 'none';
    /** Se lava y no se seca. Chasis, moto, carrocería. */
    public const WASHER = 'washer';
    /** Lavada completa. */
    public const WASHER_DRYER = 'washer_dryer';

    public const VALUES = [self::NONE, self::WASHER, self::WASHER_DRYER];

    /**
     * El default de la columna. Un trabajo tiene autor salvo que el dueño diga
     * lo contrario — al revés, la feature nacería apagada.
     */
    public const DEFAULT = self::WASHER;

    public static function isValid(?string $value): bool
    {
        return $value !== null && in_array($value, self::VALUES, true);
    }

    public static function needsWasher(?string $value): bool
    {
        return $value === self::WASHER || $value === self::WASHER_DRYER;
    }

    public static function needsDryer(?string $value): bool
    {
        return $value === self::WASHER_DRYER;
    }
}
