<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Service;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ServiceVariantResource;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceVariantController extends Controller
{
    public function index(string $serviceId)
    {
        // findOrFail also enforces tenant scope via the global TenantScope.
        $service = ServiceModel::findOrFail($serviceId);

        $variants = $service->variants()->with('consumption.product')->get();

        return ServiceVariantResource::collection($variants);
    }

    public function store(Request $request, string $serviceId): JsonResponse
    {
        $service = ServiceModel::findOrFail($serviceId);

        $data = $request->validate($this->rules());

        $variant = ServiceVariantModel::create([
            'tenant_id'    => $service->tenant_id,
            'service_id'   => $service->id,
            'label'        => $data['label'],
            'price'        => $data['price'] ?? 0,
            'duration_min' => $data['duration_min'] ?? 30,
            'sort_order'   => $data['sort_order'] ?? 0,
            'is_active'    => $data['is_active'] ?? true,
        ]);

        $variant->load('consumption.product');

        return (new ServiceVariantResource($variant))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $variantId): ServiceVariantResource
    {
        $variant = ServiceVariantModel::findOrFail($variantId);
        $data = $request->validate($this->rules());

        $variant->update($data);
        $variant->load('consumption.product');

        return new ServiceVariantResource($variant);
    }

    public function destroy(string $variantId): JsonResponse
    {
        $variant = ServiceVariantModel::findOrFail($variantId);
        $variant->delete();

        return response()->json([
            'data' => ['message' => 'Variante eliminada'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    private function rules(): array
    {
        return [
            'label'        => ['required', 'string', 'max:80'],
            'price'        => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'duration_min' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'sort_order'   => ['nullable', 'integer'],
            'is_active'    => ['boolean'],
        ];
    }
}
