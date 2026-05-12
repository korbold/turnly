<?php

declare(strict_types=1);

namespace App\Domain\Shared\Identification;

/**
 * Algorithmic validator for Ecuadorian identification numbers.
 *
 * Detects malformed or impossible IDs (typos, made-up numbers).
 * Does NOT confirm the ID is registered with SRI/Registro Civil —
 * use SriLookupService for that.
 */
final class EcIdValidator
{
    public const TYPE_RUC = 'ruc';
    public const TYPE_CEDULA = 'cedula';
    public const TYPE_PASAPORTE = 'pasaporte';

    public static function validate(string $type, string $value): bool
    {
        $value = trim($value);

        return match ($type) {
            self::TYPE_CEDULA => self::isValidCedula($value),
            self::TYPE_RUC => self::isValidRuc($value),
            self::TYPE_PASAPORTE => self::isValidPassport($value),
            default => false,
        };
    }

    public static function isValidCedula(string $cedula): bool
    {
        if (!preg_match('/^\d{10}$/', $cedula)) {
            return false;
        }

        $province = (int) substr($cedula, 0, 2);
        if ($province < 1 || ($province > 24 && $province !== 30)) {
            return false;
        }

        $third = (int) $cedula[2];
        if ($third > 5) {
            return false;
        }

        return self::mod10($cedula);
    }

    public static function isValidRuc(string $ruc): bool
    {
        if (!preg_match('/^\d{13}$/', $ruc)) {
            return false;
        }

        if (substr($ruc, 10) !== '001') {
            return false;
        }

        $province = (int) substr($ruc, 0, 2);
        if ($province < 1 || ($province > 24 && $province !== 30)) {
            return false;
        }

        $third = (int) $ruc[2];

        // Persona natural: cedula + 001
        if ($third < 6) {
            return self::mod10(substr($ruc, 0, 10));
        }

        // Sociedad pública (third == 6): mod-11 with multipliers 3,2,7,6,5,4,3,2 over first 8
        if ($third === 6) {
            return self::mod11(substr($ruc, 0, 8), [3, 2, 7, 6, 5, 4, 3, 2], (int) $ruc[8]);
        }

        // Sociedad privada / extranjera (third == 9): mod-11 with multipliers 4,3,2,7,6,5,4,3,2 over first 9
        if ($third === 9) {
            return self::mod11(substr($ruc, 0, 9), [4, 3, 2, 7, 6, 5, 4, 3, 2], (int) $ruc[9]);
        }

        return false;
    }

    public static function isValidPassport(string $passport): bool
    {
        // SRI accepts free-form alphanumeric passports, 5-20 chars.
        return (bool) preg_match('/^[A-Za-z0-9-]{5,20}$/', $passport);
    }

    private static function mod10(string $digits): bool
    {
        // Cedula algorithm: multiply first 9 by [2,1,2,1,2,1,2,1,2]; if >9 subtract 9; sum;
        // verifier = (10 - sum%10) % 10; compare with 10th digit.
        $multipliers = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $product = ((int) $digits[$i]) * $multipliers[$i];
            if ($product >= 10) {
                $product -= 9;
            }
            $sum += $product;
        }
        $verifier = (10 - ($sum % 10)) % 10;
        return $verifier === (int) $digits[9];
    }

    private static function mod11(string $digits, array $multipliers, int $expectedVerifier): bool
    {
        $sum = 0;
        $count = strlen($digits);
        for ($i = 0; $i < $count; $i++) {
            $sum += ((int) $digits[$i]) * $multipliers[$i];
        }
        $remainder = $sum % 11;
        $verifier = $remainder === 0 ? 0 : 11 - $remainder;
        if ($verifier === 10) {
            return false;
        }
        return $verifier === $expectedVerifier;
    }
}
