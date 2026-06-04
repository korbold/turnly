<?php

declare(strict_types=1);

namespace App\Domain\Inventory;

use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Support\Facades\DB;

/**
 * Turns a completed reservation (or service log) into the right set
 * of stock_movements based on the BOM of its variant.
 *
 * Resolution order for which variant to consume:
 *   1) `service_variant_id` if set on the reservation
 *   2) The active variant labeled "Default" for the service (created
 *      by the backfill migration for legacy services)
 *   3) The first active variant by sort_order — covers services that
 *      have explicit variants but the booking flow didn't pick one
 *
 * Idempotency: each subject carries a `consumption_applied_at`
 * timestamp. If it's set, this method is a no-op so retries (e.g.
 * after a transient failure) never double-debit stock.
 */
final class ConsumptionEngine
{
    public function __construct(private StockLedger $ledger) {}

    public function applyForReservation(ReservationModel $reservation): void
    {
        if ($reservation->consumption_applied_at !== null) {
            return;
        }

        $reservation->loadMissing('items');
        $userId = $reservation->assigned_to ?? $reservation->created_by;

        // Multi-item path: iterate every service_variant line so a
        // booking like (lavada + cambio aceite + aspirado) debits BOM
        // for all three variants. Also drops the matching `reserved`
        // hold for each one as the consumption is committed.
        $hadItems = false;
        foreach ($reservation->items as $item) {
            if ($item->item_type !== 'service_variant') continue;
            $hadItems = true;

            $qty = max(1, (int) $item->qty);
            for ($i = 0; $i < $qty; $i++) {
                $this->releaseVariant($item->ref_id);
                $this->applyVariant(
                    variantId: $item->ref_id,
                    refType:   'reservation',
                    refId:     $reservation->id,
                    userId:    $userId,
                );
            }
        }

        if (!$hadItems) {
            // Legacy path: no items[] — fall back to the single variant
            // recorded directly on the reservation.
            $variant = $this->resolveVariant(
                $reservation->service_variant_id,
                $reservation->service_id,
            );
            if ($variant) {
                $this->applyVariant(
                    variantId: $variant->id,
                    refType:   'reservation',
                    refId:     $reservation->id,
                    userId:    $userId,
                );
            }
        }

        $reservation->update(['consumption_applied_at' => now()]);
    }

    public function applyForServiceLog(ServiceLogModel $log): void
    {
        if ($log->consumption_applied_at !== null) {
            return;
        }

        $variant = $this->resolveVariant(
            $log->service_variant_id,
            $log->service_id,
        );

        if (!$variant) {
            $log->update(['consumption_applied_at' => now()]);
            return;
        }

        $this->applyVariant(
            variantId: $variant->id,
            refType:   'service_log',
            refId:     $log->id,
            userId:    $log->attended_by ?? $log->created_by,
        );

        $log->update(['consumption_applied_at' => now()]);
    }

    private function resolveVariant(?string $variantId, ?string $serviceId): ?ServiceVariantModel
    {
        if ($variantId) {
            return ServiceVariantModel::find($variantId);
        }

        if (!$serviceId) {
            return null;
        }

        return ServiceVariantModel::where('service_id', $serviceId)
            ->where('is_active', true)
            ->orderByRaw("CASE WHEN label = 'Default' THEN 0 ELSE 1 END")
            ->orderBy('sort_order')
            ->first();
    }

    private function applyVariant(string $variantId, string $refType, string $refId, ?string $userId): void
    {
        DB::transaction(function () use ($variantId, $refType, $refId, $userId) {
            $variant = ServiceVariantModel::with('consumption.product')->find($variantId);
            if (!$variant) return;

            foreach ($variant->consumption as $line) {
                $product = $line->product;
                if (!$product) continue;

                $this->ledger->recordConsumption(
                    product: $product,
                    qty:     (float) $line->qty,
                    userId:  $userId,
                    refType: $refType,
                    refId:   $refId,
                    note:    "BOM {$variant->label}",
                );
            }
        });
    }

    /**
     * Park BOM consumables in `reserved` ahead of the actual service.
     * Iterates over every service_variant item on the reservation so
     * a multi-line reservation reserves the union of their BOMs.
     */
    public function reserveForReservation(ReservationModel $reservation): void
    {
        $reservation->loadMissing('items');

        foreach ($reservation->items as $item) {
            if ($item->item_type !== 'service_variant') continue;
            $this->reserveVariant($item->ref_id);
        }
    }

    /**
     * Mirror of reserveForReservation: drop the hold on cancellation
     * or when an item is removed from the reservation pre-completion.
     */
    public function releaseForReservation(ReservationModel $reservation): void
    {
        $reservation->loadMissing('items');

        foreach ($reservation->items as $item) {
            if ($item->item_type !== 'service_variant') continue;
            $this->releaseVariant($item->ref_id);
        }
    }

    public function reserveVariant(string $variantId): void
    {
        $variant = ServiceVariantModel::with('consumption.product')->find($variantId);
        if (!$variant) return;
        foreach ($variant->consumption as $line) {
            if (!$line->product) continue;
            $this->ledger->reserve($line->product, (float) $line->qty);
        }
    }

    public function releaseVariant(string $variantId): void
    {
        $variant = ServiceVariantModel::with('consumption.product')->find($variantId);
        if (!$variant) return;
        foreach ($variant->consumption as $line) {
            if (!$line->product) continue;
            $this->ledger->release($line->product, (float) $line->qty);
        }
    }
}
