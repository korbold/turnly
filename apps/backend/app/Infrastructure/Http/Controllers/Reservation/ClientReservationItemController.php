<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Reservation;

use App\Domain\Reservation\Enums\ReservationStatus;
use App\Domain\Reservation\ReservationItemEditor;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ReservationItemResource;
use App\Infrastructure\Notifications\Notifications\ReservationItemsChangedByClient;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Customer-facing endpoints to edit items on an upcoming reservation.
 *
 * Hard rules (in addition to ReservationItemEditor's state guards):
 *   - Ownership: the reservation must belong to the authenticated user
 *   - Window: only `pending` and `confirmed` reservations are editable
 *   - Cooldown: edits are blocked once we're within `CHANGE_LOCK_MIN`
 *     of the scheduled start (cashier already prepping)
 *   - Floor: removing the last service line is rejected (the customer
 *     should cancel the reservation instead)
 *
 * The shared ReservationItemEditor handles the audit log + BOM hooks;
 * this controller is just the policy layer.
 */
class ClientReservationItemController extends Controller
{
    /** Lock items 30 min before the slot — cashier may be prepping. */
    private const CHANGE_LOCK_MIN = 30;

    public function __construct(private ReservationItemEditor $editor) {}

    public function index(Request $request, string $id)
    {
        $reservation = $this->findOwnedOrFail($request, $id);

        return ReservationItemResource::collection(
            $reservation->items()->orderBy('sort_order')->get()
        );
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $reservation = $this->findOwnedOrFail($request, $id);
        $this->assertEditable($reservation);

        $data = $request->validate([
            'item_type' => ['required', Rule::in(['service_variant', 'product'])],
            'ref_id'    => ['required', 'uuid'],
            'qty'       => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $qty = (int) ($data['qty'] ?? 1);

        try {
            if ($data['item_type'] === 'service_variant') {
                $variant = ServiceVariantModel::withoutGlobalScopes()
                    ->where('id', $data['ref_id'])
                    ->where('tenant_id', $reservation->tenant_id)
                    ->where('is_active', true)
                    ->with('service')
                    ->firstOrFail();

                $item = $this->editor->addServiceVariant(
                    $reservation,
                    $variant,
                    $qty,
                    $request->user()->id,
                    'edición desde app cliente',
                );
            } else {
                $product = ProductModel::withoutGlobalScopes()
                    ->where('id', $data['ref_id'])
                    ->where('tenant_id', $reservation->tenant_id)
                    ->where('is_active', true)
                    ->whereIn('type', ['sellable', 'both'])
                    ->firstOrFail();

                $item = $this->editor->addProduct(
                    $reservation,
                    $product,
                    $qty,
                    $request->user()->id,
                    'edición desde app cliente',
                );
            }
        } catch (RuntimeException $e) {
            return response()->json(
                ['error' => ['code' => 'STATE_BLOCKED', 'message' => $e->getMessage()]],
                422,
            );
        }

        $this->recalculateEstimatedEnd($reservation->fresh('items'));
        $this->notifyAdmins($reservation->fresh(['tenant', 'client']), 'added', $item->label);

        return (new ReservationItemResource($item))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, string $itemId): JsonResponse
    {
        $item = ReservationItemModel::withoutGlobalScopes()->findOrFail($itemId);
        $reservation = $this->findOwnedOrFail($request, $item->reservation_id);
        $this->assertEditable($reservation);

        // Forbid removing the last service line — customer should
        // cancel the reservation instead so the slot is freed.
        $serviceLines = $reservation->items()
            ->where('item_type', 'service_variant')
            ->count();
        if ($item->item_type === 'service_variant' && $serviceLines <= 1) {
            return response()->json([
                'error' => [
                    'code'    => 'LAST_SERVICE',
                    'message' => 'No puedes dejar la reserva sin servicios. Mejor cancélala completa.',
                ],
            ], 422);
        }

        try {
            $this->editor->remove(
                $reservation,
                $item,
                $request->user()->id,
                'edición desde app cliente',
            );
        } catch (RuntimeException $e) {
            return response()->json(
                ['error' => ['code' => 'STATE_BLOCKED', 'message' => $e->getMessage()]],
                422,
            );
        }

        $this->recalculateEstimatedEnd($reservation->fresh('items'));
        $this->notifyAdmins($reservation->fresh(['tenant', 'client']), 'removed', $item->label);

        return response()->json([
            'data' => ['message' => 'Item eliminado'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * Push the edit to the tenant's admins/cashiers so the counter
     * sees the new totals before the customer arrives. Errors here
     * are non-fatal — the audit row + reservation update are the
     * source of truth.
     */
    private function notifyAdmins(ReservationModel $reservation, string $action, string $label): void
    {
        try {
            $admins = TenantModel::find($reservation->tenant_id)
                ?->users()
                ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
                ->wherePivot('is_active', true)
                ->where('users.id', '!=', $reservation->client_id)
                ->get();

            if ($admins && $admins->isNotEmpty()) {
                Notification::send(
                    $admins,
                    new ReservationItemsChangedByClient($reservation, $action, $label),
                );
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error(
                'Failed to notify admins of client item edit',
                ['error' => $e->getMessage(), 'reservation_id' => $reservation->id],
            );
        }
    }

    /**
     * Resolves the reservation across tenants, verifying it belongs to
     * the authenticated user.
     */
    private function findOwnedOrFail(Request $request, string $id): ReservationModel
    {
        return ReservationModel::withoutGlobalScope(TenantScope::class)
            ->where('client_id', $request->user()->id)
            ->with('items')
            ->findOrFail($id);
    }

    private function assertEditable(ReservationModel $reservation): void
    {
        $status = $reservation->status instanceof ReservationStatus
            ? $reservation->status
            : ReservationStatus::from((string) $reservation->status);

        if (!in_array($status, [ReservationStatus::Pending, ReservationStatus::Confirmed], true)) {
            abort(422, 'La reserva ya no se puede modificar desde la app.');
        }

        $minutesToStart = now()->diffInMinutes($reservation->scheduled_at, false);
        if ($minutesToStart < self::CHANGE_LOCK_MIN) {
            abort(422, sprintf(
                'No puedes editar la reserva a menos de %d min del inicio.',
                self::CHANGE_LOCK_MIN,
            ));
        }
    }

    /**
     * Keep `estimated_end` in sync with the line items so the schedule
     * blocks the right amount of time after a client edit.
     */
    private function recalculateEstimatedEnd(ReservationModel $reservation): void
    {
        $variantIds = $reservation->items
            ->where('item_type', 'service_variant')
            ->pluck('ref_id')
            ->all();

        if (empty($variantIds)) return;

        $totalDuration = (int) ServiceVariantModel::withoutGlobalScopes()
            ->whereIn('id', $variantIds)
            ->sum('duration_min');

        if ($totalDuration <= 0) return;

        // scheduled_at is cast to Carbon by the model; convert to string
        // first so DateTimeImmutable accepts it across PHP versions.
        $start = new \DateTimeImmutable(
            $reservation->scheduled_at instanceof \DateTimeInterface
                ? $reservation->scheduled_at->format('Y-m-d H:i:s')
                : (string) $reservation->scheduled_at,
        );
        $reservation->update([
            'estimated_end' => $start->modify("+{$totalDuration} minutes")->format('Y-m-d H:i:s'),
        ]);
    }
}
