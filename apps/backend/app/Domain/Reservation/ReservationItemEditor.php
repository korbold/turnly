<?php

declare(strict_types=1);

namespace App\Domain\Reservation;

use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Inventory\StockLedger;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Centralises the rules around editing reservation items.
 *
 * Each operation:
 *   1) Validates the reservation state allows it
 *   2) Mutates the items
 *   3) Adjusts reserved stock (when the reservation is checked_in)
 *   4) Writes an audit row to reservation_item_changes
 *
 * Putting it all in one place keeps controllers thin and makes the
 * state-based guards impossible to bypass.
 */
final class ReservationItemEditor
{
    public function __construct(
        private ConsumptionEngine $consumption,
        private StockLedger $stock,
    ) {}

    public function addServiceVariant(
        ReservationModel $reservation,
        ServiceVariantModel $variant,
        int $qty,
        ?string $userId,
        ?string $reason = null,
    ): ReservationItemModel {
        $this->assertCanAdd($reservation);

        return DB::transaction(function () use ($reservation, $variant, $qty, $userId, $reason) {
            $serviceName = $variant->service?->name ?? 'Servicio';
            $label = "{$serviceName} · {$variant->label}";

            $item = $this->createItem(
                $reservation,
                ReservationItemModel::TYPE_SERVICE_VARIANT,
                $variant->id,
                $label,
                (float) $variant->price,
                $qty,
            );

            // Once the customer is at the counter we hold consumables.
            if ($this->isInService($reservation)) {
                for ($i = 0; $i < $qty; $i++) {
                    $this->consumption->reserveVariant($variant->id);
                }
            }

            $this->audit(
                $reservation,
                ReservationItemChangeModel::ACTION_ADDED,
                ReservationItemModel::TYPE_SERVICE_VARIANT,
                null,
                $variant->id,
                $label,
                null,
                (float) $variant->price,
                $reason,
                $userId,
            );

            return $item;
        });
    }

    public function addProduct(
        ReservationModel $reservation,
        ProductModel $product,
        int $qty,
        ?string $userId,
        ?string $reason = null,
    ): ReservationItemModel {
        $this->assertCanAdd($reservation);

        return DB::transaction(function () use ($reservation, $product, $qty, $userId, $reason) {
            $item = $this->createItem(
                $reservation,
                ReservationItemModel::TYPE_PRODUCT,
                $product->id,
                $product->name,
                (float) $product->price,
                $qty,
            );

            // Selling a product hands it over — the kardex has to reflect
            // that immediately, or inventory keeps counting bottles that
            // already left the shelf.
            $this->stock->recordSale(
                product: $product,
                qty:     (float) $qty,
                userId:  $userId,
                refType: 'reservation',
                refId:   $reservation->id,
            );

            $this->audit(
                $reservation,
                ReservationItemChangeModel::ACTION_ADDED,
                ReservationItemModel::TYPE_PRODUCT,
                null,
                $product->id,
                $product->name,
                null,
                (float) $product->price,
                $reason,
                $userId,
            );

            return $item;
        });
    }

    public function remove(ReservationModel $reservation, ReservationItemModel $item, ?string $userId, ?string $reason): void
    {
        $this->assertCanRemove($reservation, $item);

        DB::transaction(function () use ($reservation, $item, $userId, $reason) {
            $oldRef = $item->ref_id;
            $oldPrice = (float) $item->unit_price;
            $type = $item->item_type;
            $label = $item->label;

            // Release any pre-held consumables.
            if ($this->isInService($reservation) && $type === ReservationItemModel::TYPE_SERVICE_VARIANT) {
                $qty = (int) $item->qty;
                for ($i = 0; $i < $qty; $i++) {
                    $this->consumption->releaseVariant($oldRef);
                }
            }

            // Dropping a product line puts the units back on the shelf.
            if ($type === ReservationItemModel::TYPE_PRODUCT) {
                $product = ProductModel::find($oldRef);
                if ($product) {
                    $this->stock->recordReturn(
                        product: $product,
                        qty:     (float) $item->qty,
                        userId:  $userId,
                        refType: 'reservation',
                        refId:   $reservation->id,
                        note:    'Reverso por edición de la reserva',
                    );
                }
            }

            $item->delete();

            $this->audit(
                $reservation,
                ReservationItemChangeModel::ACTION_REMOVED,
                $type,
                $oldRef,
                null,
                $label,
                $oldPrice,
                null,
                $reason,
                $userId,
            );
        });
    }

    public function overridePrice(
        ReservationModel $reservation,
        ReservationItemModel $item,
        float $newPrice,
        ?string $userId,
        ?string $reason,
        ?string $reasonCode = null,
    ): ReservationItemModel {
        $this->assertCanOverridePrice($reservation);

        return DB::transaction(function () use ($reservation, $item, $newPrice, $userId, $reason, $reasonCode) {
            $oldPrice = (float) $item->unit_price;
            $item->update([
                'unit_price' => $newPrice,
                'line_total' => $newPrice * (float) $item->qty,
            ]);

            $this->audit(
                $reservation,
                ReservationItemChangeModel::ACTION_PRICE_OVERRIDE,
                $item->item_type,
                $item->ref_id,
                $item->ref_id,
                $item->label,
                $oldPrice,
                $newPrice,
                $reason,
                $userId,
                $reasonCode,
            );

            return $item;
        });
    }

    public function total(ReservationModel $reservation): float
    {
        return (float) $reservation->items()->sum('line_total');
    }

    // ── Guards ────────────────────────────────────────────────────────

    private function assertCanAdd(ReservationModel $reservation): void
    {
        $this->assertNotPaid($reservation);

        $status = $reservation->status instanceof ReservationStatus
            ? $reservation->status
            : ReservationStatus::from((string) $reservation->status);

        if (in_array($status, [ReservationStatus::Completed, ReservationStatus::Cancelled, ReservationStatus::NoShow], true)) {
            throw new RuntimeException('No se pueden agregar items a una reserva cerrada.');
        }
    }

    private function assertCanRemove(ReservationModel $reservation, ReservationItemModel $item): void
    {
        $this->assertNotPaid($reservation);

        $status = $reservation->status instanceof ReservationStatus
            ? $reservation->status
            : ReservationStatus::from((string) $reservation->status);

        // Once the wash has started we don't take consumibles off the line —
        // they may already be in use. Cashier should cancel the reservation
        // if the customer abandons mid-service.
        if (in_array($status, [
            ReservationStatus::InProgress,
            ReservationStatus::Completed,
            ReservationStatus::Cancelled,
            ReservationStatus::NoShow,
        ], true)) {
            throw new RuntimeException('No se pueden eliminar items en este estado.');
        }
    }

    private function assertCanOverridePrice(ReservationModel $reservation): void
    {
        $this->assertNotPaid($reservation);

        $status = $reservation->status instanceof ReservationStatus
            ? $reservation->status
            : ReservationStatus::from((string) $reservation->status);

        if ($status !== ReservationStatus::CheckedIn) {
            throw new RuntimeException('El precio sólo se puede ajustar durante el check-in.');
        }
    }

    /**
     * Once a reservation is paid the invoice is generated from its items, so
     * they are frozen — no adding, removing, or re-pricing. Stays locked even
     * if SRI rejects the invoice (fix via manual re-emit, not by editing).
     */
    private function assertNotPaid(ReservationModel $reservation): void
    {
        if ($reservation->payment_status === 'paid') {
            throw new RuntimeException('La reserva ya está pagada; los items no se pueden modificar.');
        }
    }

    private function isInService(ReservationModel $reservation): bool
    {
        $status = $reservation->status instanceof ReservationStatus
            ? $reservation->status
            : ReservationStatus::from((string) $reservation->status);

        return in_array($status, [ReservationStatus::CheckedIn, ReservationStatus::InProgress], true);
    }

    private function createItem(
        ReservationModel $reservation,
        string $itemType,
        string $refId,
        string $label,
        float $unitPrice,
        int $qty,
    ): ReservationItemModel {
        $sortOrder = (int) ReservationItemModel::where('reservation_id', $reservation->id)->max('sort_order') + 1;

        return ReservationItemModel::create([
            'tenant_id'      => $reservation->tenant_id,
            'reservation_id' => $reservation->id,
            'item_type'      => $itemType,
            'ref_id'         => $refId,
            'label'          => $label,
            'qty'            => $qty,
            'unit_price'     => $unitPrice,
            'line_total'     => $unitPrice * $qty,
            'sort_order'     => $sortOrder,
        ]);
    }

    private function audit(
        ReservationModel $reservation,
        string $action,
        ?string $itemType,
        ?string $oldRefId,
        ?string $newRefId,
        ?string $label,
        ?float $oldPrice,
        ?float $newPrice,
        ?string $reason,
        ?string $userId,
        ?string $reasonCode = null,
    ): void {
        ReservationItemChangeModel::create([
            'tenant_id'          => $reservation->tenant_id,
            'reservation_id'     => $reservation->id,
            'action'             => $action,
            'item_type'          => $itemType,
            'old_ref_id'         => $oldRefId,
            'new_ref_id'         => $newRefId,
            'label'              => $label,
            'old_price'          => $oldPrice,
            'new_price'          => $newPrice,
            'reason'             => $reason,
            'reason_code'        => $reasonCode,
            'changed_by_user_id' => $userId,
            'changed_at'         => now(),
        ]);
    }
}
