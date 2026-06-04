<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Inventory;

use App\Domain\Inventory\StockLedger;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\StockMovementResource;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\StockMovementModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockMovementController extends Controller
{
    public function __construct(private StockLedger $ledger) {}

    /**
     * Kardex: paginated movement history for a product.
     */
    public function index(Request $request, string $productId)
    {
        $product = ProductModel::findOrFail($productId);

        $query = StockMovementModel::where('product_id', $product->id)
            ->with('user')
            ->orderByDesc('created_at');

        if ($request->has('type')) {
            $query->where('type', $request->string('type'));
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->date('to'));
        }

        $movements = $query->paginate($request->integer('per_page', 30));

        return StockMovementResource::collection($movements);
    }

    /**
     * Record a manual movement: purchase, adjustment, or return.
     * Sale/consumption are emitted internally by reservation completion.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'uuid', 'exists:products,id'],
            'type'       => ['required', Rule::in(['purchase', 'adjustment', 'return'])],
            'qty'        => ['required', 'numeric'],
            'unit_cost'  => ['nullable', 'numeric', 'min:0'],
            'note'       => ['nullable', 'string', 'max:500'],
        ]);

        $product = ProductModel::findOrFail($data['product_id']);
        $userId = $request->user()?->id;

        $movement = match ($data['type']) {
            'purchase' => $this->ledger->recordPurchase(
                product:  $product,
                qty:      (float) $data['qty'],
                unitCost: (float) ($data['unit_cost'] ?? $product->cost),
                userId:   $userId,
                refType:  'manual_purchase',
                note:     $data['note'] ?? null,
            ),
            'adjustment' => $this->ledger->recordAdjustment(
                product: $product,
                delta:   (float) $data['qty'],
                userId:  $userId,
                note:    $data['note'] ?? null,
            ),
            'return' => $this->ledger->recordReturn(
                product: $product,
                qty:     (float) $data['qty'],
                userId:  $userId,
                refType: 'manual_return',
                note:    $data['note'] ?? null,
            ),
        };

        $movement->load('user');

        return (new StockMovementResource($movement))->response()->setStatusCode(201);
    }
}
