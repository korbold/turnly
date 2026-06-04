<?php

declare(strict_types=1);

namespace App\Domain\Reservation;

use App\Infrastructure\Persistence\Models\ReservationModel;

/**
 * Human-readable summaries built off a reservation's `items[]`. Phase 3
 * lets a booking carry multiple services, so notification bodies that
 * still say `service->name` only mention the first one. This collapses
 * the items list into a short Spanish phrase you can drop into the
 * notification body.
 *
 * Examples (with variant tail stripped):
 *   - 1 item   → "Cambio de aceite"
 *   - 2 items  → "Cambio de aceite y Lavado de motor"
 *   - 3 items  → "Cambio de aceite, Lavado de motor y Encerada full"
 *   - 4+ items → "Cambio de aceite, Lavado de motor y 2 más"
 */
final class ReservationSummary
{
    public static function servicesLabel(ReservationModel $reservation): string
    {
        $items = $reservation->relationLoaded('items')
            ? $reservation->items
            : $reservation->items()->get();

        $labels = $items
            ->map(fn ($item) => self::trimVariantSuffix((string) $item->label))
            ->filter(fn ($label) => $label !== '')
            ->values();

        if ($labels->isEmpty()) {
            // Pre-Phase 3 row with no items[] — fall back to the legacy
            // single-service pointer kept on the reservation row.
            return $reservation->service?->name ?? 'tu reserva';
        }

        $count = $labels->count();
        if ($count === 1) {
            return $labels->first();
        }
        if ($count === 2) {
            return $labels->join(' y ');
        }
        if ($count === 3) {
            return $labels->slice(0, 2)->join(', ') . ' y ' . $labels->last();
        }

        $extras = $count - 2;
        return $labels->slice(0, 2)->join(', ') . " y {$extras} más";
    }

    /**
     * Stored item labels include the variant: "Cambio de aceite · Mineral".
     * Notification bodies are tight on space, so drop everything past the
     * separator. Falls back to the original string if there's no marker.
     */
    private static function trimVariantSuffix(string $label): string
    {
        $pos = mb_strpos($label, ' · ');
        return $pos === false ? $label : trim(mb_substr($label, 0, $pos));
    }
}
