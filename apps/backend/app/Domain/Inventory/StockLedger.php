<?php

declare(strict_types=1);

namespace App\Domain\Inventory;

use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ProductStockLevelModel;
use App\Infrastructure\Persistence\Models\StockMovementModel;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Append-only stock ledger.
 *
 * All stock changes flow through here so the `stock_movements` table is
 * the single source of truth; `product_stock_levels` is a cached
 * rollup that is recomputed transactionally on every movement.
 *
 * Valuation method: weighted average cost. Each purchase blends its
 * unit_cost into the existing on_hand at the moment of receipt. Other
 * movement types do not change avg_cost.
 */
final class StockLedger
{
    public function recordPurchase(
        ProductModel $product,
        float $qty,
        float $unitCost,
        ?string $userId = null,
        ?string $refType = null,
        ?string $refId = null,
        ?string $note = null,
    ): StockMovementModel {
        $this->assertPositive($qty, 'purchase qty');
        return $this->record($product, 'purchase', $qty, $unitCost, $userId, $refType, $refId, $note);
    }

    public function recordSale(
        ProductModel $product,
        float $qty,
        ?string $userId = null,
        ?string $refType = null,
        ?string $refId = null,
        ?string $note = null,
    ): StockMovementModel {
        $this->assertPositive($qty, 'sale qty');
        return $this->record($product, 'sale', -$qty, 0, $userId, $refType, $refId, $note);
    }

    public function recordConsumption(
        ProductModel $product,
        float $qty,
        ?string $userId = null,
        ?string $refType = null,
        ?string $refId = null,
        ?string $note = null,
    ): StockMovementModel {
        $this->assertPositive($qty, 'consumption qty');
        return $this->record($product, 'consumption', -$qty, 0, $userId, $refType, $refId, $note);
    }

    /**
     * Manual correction. `delta` may be positive (found stock) or
     * negative (loss/breakage). Cost stays on the books.
     */
    public function recordAdjustment(
        ProductModel $product,
        float $delta,
        ?string $userId = null,
        ?string $note = null,
    ): StockMovementModel {
        if ($delta === 0.0) {
            throw new InvalidArgumentException('adjustment delta cannot be zero');
        }
        return $this->record($product, 'adjustment', $delta, 0, $userId, 'adjustment', null, $note);
    }

    public function recordReturn(
        ProductModel $product,
        float $qty,
        ?string $userId = null,
        ?string $refType = null,
        ?string $refId = null,
        ?string $note = null,
    ): StockMovementModel {
        $this->assertPositive($qty, 'return qty');
        return $this->record($product, 'return', $qty, 0, $userId, $refType, $refId, $note);
    }

    private function record(
        ProductModel $product,
        string $type,
        float $signedQty,
        float $unitCost,
        ?string $userId,
        ?string $refType,
        ?string $refId,
        ?string $note,
    ): StockMovementModel {
        return DB::transaction(function () use ($product, $type, $signedQty, $unitCost, $userId, $refType, $refId, $note) {
            $movement = StockMovementModel::create([
                'tenant_id'  => $product->tenant_id,
                'product_id' => $product->id,
                'type'       => $type,
                'qty'        => $signedQty,
                'unit_cost'  => $unitCost,
                'ref_type'   => $refType,
                'ref_id'     => $refId,
                'user_id'    => $userId,
                'note'       => $note,
            ]);

            // Lock the level row so concurrent purchases/consumptions can't
            // interleave a half-applied weighted-average calc.
            $level = ProductStockLevelModel::query()
                ->lockForUpdate()
                ->firstOrCreate(
                    ['product_id' => $product->id],
                    ['on_hand' => 0, 'reserved' => 0, 'avg_cost' => 0]
                );

            $oldOnHand = (float) $level->on_hand;
            $newOnHand = $oldOnHand + $signedQty;

            if ($type === 'purchase' && $signedQty > 0) {
                // Weighted average: only if there is non-negative existing stock.
                $oldValue = max($oldOnHand, 0) * (float) $level->avg_cost;
                $addedValue = $signedQty * $unitCost;
                $denominator = max($oldOnHand, 0) + $signedQty;
                $level->avg_cost = $denominator > 0 ? ($oldValue + $addedValue) / $denominator : $unitCost;
            }

            $level->on_hand = $newOnHand;
            $level->updated_at = now();
            $level->save();

            return $movement;
        });
    }

    private function assertPositive(float $qty, string $label): void
    {
        if ($qty <= 0) {
            throw new InvalidArgumentException("{$label} must be positive");
        }
    }

    /**
     * Hold stock for a pending consumption without removing it from
     * on_hand. Used when a reservation is checked in: the BOM amount
     * moves into `reserved` so concurrent bookings can't claim the
     * same units, but the ledger only records actual `out` movements
     * when the service is completed.
     */
    public function reserve(ProductModel $product, float $qty): void
    {
        $this->assertPositive($qty, 'reserve qty');
        DB::transaction(function () use ($product, $qty) {
            $level = ProductStockLevelModel::query()
                ->lockForUpdate()
                ->firstOrCreate(['product_id' => $product->id], ['on_hand' => 0, 'reserved' => 0, 'avg_cost' => 0]);
            $level->reserved = (float) $level->reserved + $qty;
            $level->updated_at = now();
            $level->save();
        });
    }

    /**
     * Mirror of reserve(): drop the hold when a reservation is
     * cancelled or its items are removed before completion.
     */
    public function release(ProductModel $product, float $qty): void
    {
        $this->assertPositive($qty, 'release qty');
        DB::transaction(function () use ($product, $qty) {
            $level = ProductStockLevelModel::query()
                ->lockForUpdate()
                ->firstOrCreate(['product_id' => $product->id], ['on_hand' => 0, 'reserved' => 0, 'avg_cost' => 0]);
            $level->reserved = max(0.0, (float) $level->reserved - $qty);
            $level->updated_at = now();
            $level->save();
        });
    }
}
