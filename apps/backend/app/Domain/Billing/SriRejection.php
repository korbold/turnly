<?php

declare(strict_types=1);

namespace App\Domain\Billing;

/**
 * Arma el texto de un rechazo del SRI para guardarlo en `invoice_error`.
 *
 * El SRI responde con códigos genéricos — "ARCHIVO NO CUMPLE ESTRUCTURA XML"
 * cubre desde un XSD inválido hasta un ambiente equivocado — y pone el motivo
 * accionable en `informacionAdicional`. Quedarse sólo con `mensaje` deja al
 * dueño del negocio mirando una pantalla que no le dice qué corregir, y obliga
 * a entrar por SSH a producción para averiguarlo. Pasó con FEDER.
 */
final class SriRejection
{
    /**
     * @param  array  $invoice  la factura como la devuelve el billing service
     * @return string|null  null cuando no hay nada que contar, para que el
     *                      llamador use su propio texto por defecto en vez de
     *                      pintar una tarjeta de error vacía
     */
    public static function describe(array $invoice): ?string
    {
        $mensajes = $invoice['sri_response']['mensajes'] ?? $invoice['mensajes'] ?? null;

        if (!is_array($mensajes) || $mensajes === []) {
            return null;
        }

        $primero = $mensajes[0] ?? [];

        $mensaje = trim((string) ($primero['mensaje'] ?? ''));
        $detalle = trim((string) ($primero['info_adicional'] ?? ''));

        if ($mensaje === '' && $detalle === '') {
            return null;
        }

        // El SRI a veces repite el mismo texto en los dos campos; mostrarlo
        // dos veces sólo hace ruido.
        if ($detalle === '' || $detalle === $mensaje) {
            return $mensaje !== '' ? $mensaje : $detalle;
        }

        if ($mensaje === '') {
            return $detalle;
        }

        return $mensaje . ': ' . $detalle;
    }
}
