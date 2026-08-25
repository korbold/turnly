<?php

declare(strict_types=1);

namespace App\Domain\Cash;

/**
 * El conteo del cajón, denominación por denominación.
 *
 * Existe porque un total tecleado no prueba que alguien haya contado. El
 * arqueo del 24 de agosto en FEDER declaró $464.00 —exactamente el efectivo
 * cobrado ese día— cuando el cajón además tenía la base con la que se abrió.
 * Un campo vacío que pide "cuánto hay" acepta cualquier número; una grilla que
 * pide "cuántos billetes de $20" obliga a mirar adentro.
 *
 * Las denominaciones son las que circulan en Ecuador. La lista es cerrada a
 * propósito: aceptar un billete de $3 sería aceptar cualquier cifra escrita en
 * cualquier casilla.
 */
final class CashCount
{
    /** Billetes en circulación. */
    public const BILLS = ['100', '50', '20', '10', '5', '1'];

    /**
     * Monedas, EN CENTAVOS: un dólar, cincuenta, veinticinco, diez, cinco y
     * un centavo.
     *
     * En centavos y no en '0.25' porque Laravel lee el punto de una clave como
     * separador de rutas: la regla `coins.0.25` valida un `25` adentro de un
     * `0`, y la moneda de veinticinco nunca llega. Enteros también evitan que
     * el valor de la moneda sea un float.
     */
    public const COINS = ['100', '50', '25', '10', '5', '1'];

    /**
     * Cuánto suma un conteo.
     *
     * En centavos enteros y recién al final a dólares: sumar 0.01 tres veces
     * en punto flotante da 0.030000000000000002, y un arqueo que se corre un
     * centavo es un arqueo que no cuadra.
     */
    public static function total(array $breakdown): float
    {
        $centavos = 0;

        foreach (self::BILLS as $valor) {
            $centavos += (int) ($breakdown['bills'][$valor] ?? 0) * (int) round((float) $valor * 100);
        }

        foreach (self::COINS as $valor) {
            $centavos += (int) ($breakdown['coins'][$valor] ?? 0) * (int) $valor;
        }

        // Vales, cheques, vouchers: están en el cajón y cuentan, pero no son
        // una denominación.
        $centavos += (int) round(((float) ($breakdown['other_amount'] ?? 0)) * 100);

        return $centavos / 100;
    }

    /** Las reglas de validación de un desglose, para el controlador. */
    public static function rules(string $prefix = 'breakdown'): array
    {
        $reglas = [
            $prefix                  => ['sometimes', 'array'],
            "{$prefix}.bills"        => ['sometimes', 'array'],
            "{$prefix}.coins"        => ['sometimes', 'array'],
            "{$prefix}.other_amount" => ['sometimes', 'nullable', 'numeric', 'min:0'],
            // Un "otros $5" sin decir qué son es un faltante con otro nombre.
            "{$prefix}.other_note"   => ['required_with:' . $prefix . '.other_amount', 'nullable', 'string', 'max:120'],
        ];

        foreach (self::BILLS as $valor) {
            $reglas["{$prefix}.bills.{$valor}"] = ['sometimes', 'integer', 'min:0', 'max:100000'];
        }

        foreach (self::COINS as $valor) {
            $reglas["{$prefix}.coins.{$valor}"] = ['sometimes', 'integer', 'min:0', 'max:100000'];
        }

        return $reglas;
    }

    /** Una denominación que no existe: no hay billete de $3. */
    public static function hasUnknownDenomination(array $breakdown): bool
    {
        $sobran = array_diff(array_keys($breakdown['bills'] ?? []), self::BILLS);
        $sobran = array_merge($sobran, array_diff(array_keys($breakdown['coins'] ?? []), self::COINS));

        return $sobran !== [];
    }
}
