<?php
// apps/backend/app/Domain/ClientResource/Plate.php

declare(strict_types=1);

namespace App\Domain\ClientResource;

/**
 * La placa de un vehículo, comparable.
 *
 * El cajero escribe rápido y con el auto adelante: "IBD-9115", "ibd 9115",
 * "IBD9115 " son el mismo auto. Sin normalizar, el chequeo de duplicados no
 * sirve de nada — y en producción ya hay una placa cargada cuatro veces, con
 * su historial y su deuda partidos entre las cuatro filas.
 */
final class Plate
{
    /** Las claves con que los tenants guardan la placa en sus campos propios. */
    private const KEYS = '/^(plate|placa)$/i';

    /** Sin espacios, sin guiones, en mayúsculas. */
    public static function normalize(?string $raw): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $raw) ?? '');
    }

    /**
     * "000", "0000", "-" : lo que el mostrador escribe cuando el vehículo no
     * tiene placa. Nueve motos en producción comparten "000" y no son el mismo
     * vehículo, así que estas nunca bloquean.
     *
     * El criterio es "no tiene letras": una placa ecuatoriana real siempre las
     * lleva, y cualquier relleno numérico queda afuera sin listar casos.
     */
    public static function isPlaceholder(?string $raw): bool
    {
        $normal = self::normalize($raw);

        return $normal === '' || !preg_match('/[A-Z]/', $normal);
    }

    /** La placa dentro de los campos personalizados del tenant, si la hay. */
    public static function fromData(?array $data): ?string
    {
        foreach ($data ?? [] as $key => $value) {
            if (preg_match(self::KEYS, (string) $key) && is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        return null;
    }
}
