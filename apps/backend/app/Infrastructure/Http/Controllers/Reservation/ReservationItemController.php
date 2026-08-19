<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Reservation;

use App\Domain\Pricing\PriceChangeReason;
use App\Domain\Reservation\ReservationItemEditor;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ReservationItemResource;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class ReservationItemController extends Controller
{
    public function __construct(private ReservationItemEditor $editor) {}

    public function index(string $reservationId)
    {
        $reservation = ReservationModel::with('items')->findOrFail($reservationId);
        return ReservationItemResource::collection($reservation->items);
    }

    public function store(Request $request, string $reservationId): JsonResponse
    {
        $reservation = ReservationModel::findOrFail($reservationId);

        $data = $request->validate([
            'item_type' => ['required', Rule::in(['service_variant', 'product'])],
            'ref_id'    => ['required', 'uuid'],
            'qty'       => ['nullable', 'integer', 'min:1', 'max:99'],
            'reason'    => ['nullable', 'string', 'max:500'],
        ]);

        $userId = $request->user()?->id;
        $qty = $data['qty'] ?? 1;

        try {
            $item = match ($data['item_type']) {
                'service_variant' => $this->editor->addServiceVariant(
                    $reservation,
                    ServiceVariantModel::findOrFail($data['ref_id']),
                    $qty,
                    $userId,
                    $data['reason'] ?? null,
                ),
                'product' => $this->editor->addProduct(
                    $reservation,
                    ProductModel::findOrFail($data['ref_id']),
                    $qty,
                    $userId,
                    $data['reason'] ?? null,
                ),
            };
        } catch (RuntimeException $e) {
            return response()->json(['error' => ['code' => 'STATE_BLOCKED', 'message' => $e->getMessage()]], 422);
        }

        return (new ReservationItemResource($item))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, string $itemId): JsonResponse
    {
        $item = ReservationItemModel::with('reservation')->findOrFail($itemId);
        $reservation = $item->reservation;

        try {
            $this->editor->remove(
                $reservation,
                $item,
                $request->user()?->id,
                $request->string('reason')->toString() ?: null,
            );
        } catch (RuntimeException $e) {
            return response()->json(['error' => ['code' => 'STATE_BLOCKED', 'message' => $e->getMessage()]], 422);
        }

        return response()->json([
            'data' => ['message' => 'Item eliminado'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function overridePrice(Request $request, string $itemId): JsonResponse
    {
        $data = $request->validate([
            'unit_price'  => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            // El código es obligatorio: tocar este endpoint ya es, por
            // definición, un desvío del catálogo.
            'reason_code' => ['required', 'string', Rule::in(PriceChangeReason::CODES)],
            // La nota es libre y sólo obligatoria para "otro".
            'reason'      => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['reason_code'] === PriceChangeReason::REQUIRES_NOTE
            && trim((string) ($data['reason'] ?? '')) === '') {
            return response()->json([
                'error' => [
                    'code'    => 'REASON_INVALID',
                    'message' => 'Elegiste "Otro": escribí de qué se trata.',
                ],
            ], 422);
        }

        $item = ReservationItemModel::with('reservation')->findOrFail($itemId);

        try {
            $item = $this->editor->overridePrice(
                $item->reservation,
                $item,
                (float) $data['unit_price'],
                $request->user()?->id,
                $data['reason'] ?? null,
                $data['reason_code'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['error' => ['code' => 'STATE_BLOCKED', 'message' => $e->getMessage()]], 422);
        }

        return (new ReservationItemResource($item))->response();
    }

    public function changes(string $reservationId): JsonResponse
    {
        $reservation = ReservationModel::findOrFail($reservationId);
        $changes = ReservationItemChangeModel::where('reservation_id', $reservation->id)
            ->with('changedBy:id,name')
            ->orderByDesc('changed_at')
            ->get();

        return response()->json([
            'data' => $changes->map(fn ($c) => [
                'id'         => $c->id,
                'action'     => $c->action,
                'item_type'  => $c->item_type,
                'label'      => $c->label,
                'old_price'  => $c->old_price !== null ? (float) $c->old_price : null,
                'new_price'  => $c->new_price !== null ? (float) $c->new_price : null,
                'reason'     => $c->reason,
                'changed_by' => $c->changedBy ? ['id' => $c->changedBy->id, 'name' => $c->changedBy->name] : null,
                'changed_at' => $c->changed_at?->toIso8601String(),
            ])->all(),
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
