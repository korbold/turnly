<?php

declare(strict_types=1);

namespace App\Domain\Identity;

/**
 * Ecuadorian Cédula (10-digit) and RUC (13-digit) checksum validators.
 *
 * Cédula: modulus 10 with weights 2,1,2,1,2,1,2,1,2.
 * RUC variants:
 *   - Natural person (3rd digit < 6): mod-10 on first 10 digits, +001 suffix
 *   - Public entity   (3rd digit = 6): mod-11 with weights 3,2,7,6,5,4,3,2 over first 8 digits
 *   - Private company (3rd digit = 9): mod-11 with weights 4,3,2,7,6,5,4,3,2 over first 9 digits
 *
 * Rules are codified in SRI's "Algoritmo de validación de identificación
 * y RUC" reference. We only validate format + checksum; SRI can still
 * reject an invoice for other reasons (non-existent RUC, suspended, etc.).
 */
final class EcuadorIdValidator
{
    public static function isCedula(string $value): bool
    {
        if (!preg_match('/^\d{10}$/', $value)) return false;

        $province = (int) substr($value, 0, 2);
        if ($province < 1 || ($province > 24 && $province !== 30)) return false;

        $third = (int) $value[2];
        if ($third > 5) return false;

        $weights = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $digit = (int) $value[$i] * $weights[$i];
            if ($digit >= 10) $digit -= 9;
            $sum += $digit;
        }

        $check = (10 - ($sum % 10)) % 10;
        return $check === (int) $value[9];
    }

    public static function isRuc(string $value): bool
    {
        if (!preg_match('/^\d{13}$/', $value)) return false;
        if (substr($value, 10, 3) === '000') return false;

        $third = (int) $value[2];

        if ($third < 6) {
            // Natural person: same checksum as the cedula on the first 10 digits.
            return self::isCedula(substr($value, 0, 10)) && substr($value, 10, 3) === '001';
        }

        if ($third === 6) {
            return self::publicEntityChecksum($value);
        }

        if ($third === 9) {
            return self::privateCompanyChecksum($value);
        }

        return false;
    }

    private static function publicEntityChecksum(string $value): bool
    {
        $weights = [3, 2, 7, 6, 5, 4, 3, 2];
        $sum = 0;
        for ($i = 0; $i < 8; $i++) {
            $sum += (int) $value[$i] * $weights[$i];
        }
        $mod = $sum % 11;
        $check = $mod === 0 ? 0 : 11 - $mod;
        return $check === (int) $value[8] && substr($value, 9, 4) === '0001';
    }

    private static function privateCompanyChecksum(string $value): bool
    {
        $weights = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += (int) $value[$i] * $weights[$i];
        }
        $mod = $sum % 11;
        $check = $mod === 0 ? 0 : 11 - $mod;
        return $check === (int) $value[9] && substr($value, 10, 3) === '001';
    }
}
