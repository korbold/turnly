<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Service;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ServiceVariantConsumptionModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Bill of materials (BOM) editor for a service variant.
 *
 * A variant has a single set of consumption lines; the editor sends
 * the whole list and we replace it atomically. This keeps the UI
 * simple (drag rows around, submit) and avoids drift between client
 * and server when a partial PATCH would mean tracking which rows the
 * client kept vs. dropped.
 */
class BomController extends Controller
{
    public function index(string $variantId)
    {
        $variant = ServiceVariantModel::findOrFail($variantId);

        $lines = $variant->consumption()->with('product')->get();

        return response()->json([
            'data' => $lines->map(fn ($l) => [
                'id'         => $l->id,
                'product_id' => $l->product_id,
                'qty'        => (float) $l->qty,
                'product'    => $l->product ? [
                    'id'   => $l->product->id,
                    'name' => $l->product->name,
                    'unit' => $l->product->unit,
                    'sku'  => $l->product->sku,
                ] : null,
            ])->all(),
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * Atomic replace. Body: { lines: [{ product_id, qty }, ...] }.
     * Sending [] clears the BOM. Duplicates per product_id are
     * rejected at validation time.
     */
    public function replace(Request $request, string $variantId): JsonResponse
    {
        $variant = ServiceVariantModel::findOrFail($variantId);

        $data = $request->validate([
            'lines'              => ['present', 'array'],
            'lines.*.product_id' => ['required', 'uuid', 'distinct', 'exists:products,id'],
            'lines.*.qty'        => ['required', 'numeric', 'min:0.001', 'max:99999999.999'],
        ]);

        $tenantId = $variant->tenant_id;

        // Reject products from other tenants — `exists:products,id`
        // doesn't enforce tenancy on its own.
        $ids = collect($data['lines'])->pluck('product_id')->all();
        if (!empty($ids)) {
            $valid = ProductModel::whereIn('id', $ids)
                ->where('tenant_id', $tenantId)
                ->pluck('id')
                ->all();

            if (count($valid) !== count($ids)) {
                return response()->json([
                    'error' => [
                        'code'    => 'PRODUCT_NOT_IN_TENANT',
                        'message' => 'Uno de los productos no pertenece al negocio',
                    ],
                ], 422);
            }
        }

        DB::transaction(function () use ($variant, $data) {
            ServiceVariantConsumptionModel::where('service_variant_id', $variant->id)->delete();

            foreach ($data['lines'] as $line) {
                ServiceVariantConsumptionModel::create([
                    'service_variant_id' => $variant->id,
                    'product_id'         => $line['product_id'],
                    'qty'                => $line['qty'],
                ]);
            }
        });

        return $this->index($variantId);
    }
}
