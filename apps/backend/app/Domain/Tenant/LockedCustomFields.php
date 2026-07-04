<?php

declare(strict_types=1);

namespace App\Domain\Tenant;

use Illuminate\Validation\ValidationException;

final class LockedCustomFields
{
    /**
     * Protect locked custom fields (affects_variant === true) on tenant update.
     * Locked fields cannot be removed; their key/type/affects_variant are
     * restored from the existing record; options are add-only (superset).
     *
     * @param array<int, array<string, mixed>> $incoming
     * @param array<int, array<string, mixed>> $existing
     * @return array<int, array<string, mixed>>
     */
    public static function reconcile(array $incoming, array $existing): array
    {
        $lockedExisting = array_values(array_filter(
            $existing,
            fn ($f) => ($f['affects_variant'] ?? false) === true,
        ));

        foreach ($lockedExisting as $locked) {
            $key = $locked['key'];
            $idx = self::indexOfKey($incoming, $key);

            if ($idx === null) {
                // Client dropped it — re-inject the protected field.
                $incoming[] = $locked;
                continue;
            }

            $seeded = is_array($locked['options'] ?? null) ? $locked['options'] : [];
            $submitted = is_array($incoming[$idx]['options'] ?? null) ? $incoming[$idx]['options'] : [];
            $removed = array_values(array_diff($seeded, $submitted));
            if (!empty($removed)) {
                throw ValidationException::withMessages([
                    'custom_fields' => 'No se pueden renombrar ni eliminar las opciones fijas de "'
                        . ($locked['label'] ?? $key) . '": ' . implode(', ', $removed),
                ]);
            }

            // Restore locked attributes; keep submitted (superset) options + label edits allowed only on non-seeded parts.
            $incoming[$idx]['key'] = $locked['key'];
            $incoming[$idx]['type'] = $locked['type'];
            $incoming[$idx]['affects_variant'] = true;
            $incoming[$idx]['locked'] = true;
        }

        return array_values($incoming);
    }

    private static function indexOfKey(array $fields, string $key): ?int
    {
        foreach ($fields as $i => $f) {
            if (($f['key'] ?? null) === $key) return $i;
        }
        return null;
    }
}
