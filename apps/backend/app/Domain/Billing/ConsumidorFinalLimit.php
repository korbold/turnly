<?php

declare(strict_types=1);

namespace App\Domain\Billing;

/**
 * SRI rule: a comprobante issued to CONSUMIDOR FINAL (tipo 07 /
 * 9999999999999) may not exceed USD 50 — above that the receptor has to
 * be identified with cédula or RUC.
 *
 * Sending one anyway is not a free retry: the SRI consumes the
 * secuencial and answers "ERROR EN LA IDENTIFICACION DEL RECEPTOR"
 * (identificador 69), which reads like a data glitch and invites the
 * cashier to press Reintentar forever. Checking before emitting keeps
 * the sequence intact and puts the real instruction on screen.
 */
final class ConsumidorFinalLimit
{
    public const MAX_TOTAL = 50.0;

    public const CODE = 'CONSUMIDOR_FINAL_LIMIT';

    public const MESSAGE = 'Por reglamento del SRI, una venta mayor a $50 no puede facturarse a CONSUMIDOR FINAL. Registra la cédula o RUC del cliente en Datos de facturación y vuelve a facturar.';

    public static function blocks(bool $isFinalConsumer, float $totalWithIva): bool
    {
        return $isFinalConsumer && round($totalWithIva, 2) > self::MAX_TOTAL;
    }

    /**
     * The $50 ceiling is measured against importeTotal (IVA included).
     * Tenants on `excluded` show net prices and let the SRI add the tax,
     * so a $45 ticket really bills $51.75 and must be identified.
     */
    public static function totalWithIva(float $displayedTotal, ?string $ivaMode): float
    {
        return $ivaMode === 'excluded' ? $displayedTotal * 1.15 : $displayedTotal;
    }
}
