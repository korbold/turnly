<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Inventory;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ProductResource;
use App\Infrastructure\Persistence\Models\ProductModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = app('current_tenant_id');

        $query = ProductModel::with('stockLevel')->orderBy('name');

        if ($search = $request->string('q')->trim()->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($request->has('type')) {
            $query->where('type', $request->string('type'));
        }

        if ($request->boolean('low_stock')) {
            // products whose on_hand is at or below stock_min
            $query->whereHas('stockLevel', function ($q) {
                $q->whereColumn('on_hand', '<=', \DB::raw('(select stock_min from products where products.id = product_stock_levels.product_id)'));
            });
        }

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        $products = $query->paginate($request->integer('per_page', 25));

        return ProductResource::collection($products);
    }

    public function show(string $id): ProductResource
    {
        $product = ProductModel::with('stockLevel')->findOrFail($id);
        return new ProductResource($product);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $data = $request->validate($this->rules($tenantId));

        $product = ProductModel::create([
            'tenant_id' => $tenantId,
            ...$data,
        ]);

        $product->load('stockLevel');

        return (new ProductResource($product))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $id): ProductResource
    {
        $tenantId = app('current_tenant_id');
        $product = ProductModel::findOrFail($id);
        $data = $request->validate($this->rules($tenantId, $product->id));

        $product->update($data);
        $product->load('stockLevel');

        return new ProductResource($product);
    }

    public function destroy(string $id): JsonResponse
    {
        $product = ProductModel::findOrFail($id);
        // Soft delete: ledger movements remain. Product disappears from
        // active lists but historical kardex stays auditable.
        $product->delete();

        return response()->json([
            'data' => ['message' => 'Producto eliminado'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    private function rules(string $tenantId, ?string $ignoreId = null): array
    {
        return [
            'sku'         => [
                'nullable', 'string', 'max:60',
                Rule::unique('products', 'sku')
                    ->where(fn ($q) => $q->where('tenant_id', $tenantId)->whereNull('deleted_at'))
                    ->ignore($ignoreId),
            ],
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type'        => ['required', Rule::in(['consumable', 'sellable', 'both'])],
            'unit'        => ['required', Rule::in(['ml', 'L', 'g', 'kg', 'u'])],
            'cost'        => ['nullable', 'numeric', 'min:0', 'max:99999999.9999'],
            'price'       => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'tax_rate'    => ['nullable', 'numeric', 'min:0', 'max:100'],
            'stock_min'   => ['nullable', 'numeric', 'min:0', 'max:99999999.999'],
            'is_active'   => ['boolean'],
        ];
    }
}
