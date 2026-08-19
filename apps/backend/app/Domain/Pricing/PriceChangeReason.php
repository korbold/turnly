<?php
// apps/backend/app/Domain/Pricing/PriceChangeReason.php

declare(strict_types=1);

namespace App\Domain\Pricing;

/**
 * Por qué un precio se apartó del catálogo.
 *
 * Lista cerrada y no configurable a propósito. Texto libre se degrada a
 * "descuento", "x", "asd" en un mes y deja el reporte sin agrupar — y peor,
 * permite escribir literalmente "cliente especial", que es la excusa que este
 * diseño existe para volver auditable.
 *
 * Cinco motivos cubren barbería, lavadora, spa y consultorio igual. Volverla
 * configurable después es leer una tabla en vez de esta constante, sin migrar
 * nada: los valores ya son categorías.
 */
final class PriceChangeReason
{
    public const CLIENTE_FRECUENTE = 'cliente_frecuente';
    public const PROMOCION         = 'promocion';
    public const CORTESIA          = 'cortesia';
    public const ACORDADO          = 'acordado';
    public const OTRO              = 'otro';

    public const CODES = [
        self::CLIENTE_FRECUENTE,
        self::PROMOCION,
        self::CORTESIA,
        self::ACORDADO,
        self::OTRO,
    ];

    public const LABELS = [
        self::CLIENTE_FRECUENTE => 'Cliente frecuente',
        self::PROMOCION         => 'Promoción',
        self::CORTESIA          => 'Reclamo o cortesía',
        self::ACORDADO          => 'Precio acordado con el dueño',
        self::OTRO              => 'Otro',
    ];

    /**
     * El único que exige nota escrita. Es también el termómetro de la lista:
     * si la mayoría de los descuentos caen acá, faltan motivos.
     */
    public const REQUIRES_NOTE = self::OTRO;

    public static function isValid(?string $code): bool
    {
        return $code !== null && in_array($code, self::CODES, true);
    }

    public static function label(?string $code): ?string
    {
        return $code === null ? null : (self::LABELS[$code] ?? null);
    }
}
