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
        $this->assertVehicleTypesAllowed($service->tenant_id, $data['vehicle_types'] ?? []);

        $variant = ServiceVariantModel::create([
            'tenant_id'     => $service->tenant_id,
            'service_id'    => $service->id,
            'label'         => $data['label'],
            'vehicle_types' => $data['vehicle_types'] ?? [],
            'price'         => $data['price'] ?? 0,
            'duration_min'  => $data['duration_min'] ?? 30,
            'sort_order'    => $data['sort_order'] ?? 0,
            'is_active'     => $data['is_active'] ?? true,
        ]);

        $variant->load('consumption.product');

        return (new ServiceVariantResource($variant))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $variantId): ServiceVariantResource
    {
        $variant = ServiceVariantModel::findOrFail($variantId);
        $data = $request->validate($this->rules());
        if (array_key_exists('vehicle_types', $data)) {
            $this->assertVehicleTypesAllowed($variant->tenant_id, $data['vehicle_types'] ?? []);
        }

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
            'label'           => ['required', 'string', 'max:80'],
            'vehicle_types'   => ['nullable', 'array'],
            'vehicle_types.*' => ['string', 'max:80'],
            'price'           => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'duration_min'    => ['nullable', 'integer', 'min:1', 'max:1440'],
            'sort_order'      => ['nullable', 'integer'],
            'is_active'       => ['boolean'],
        ];
    }

    private function assertVehicleTypesAllowed(string $tenantId, array $types): void
    {
        if (empty($types)) return;
        $tenant = \App\Infrastructure\Persistence\Models\TenantModel::find($tenantId);
        $fields = is_array($tenant?->custom_fields) ? $tenant->custom_fields : [];
        $field = collect($fields)->first(fn ($f) => ($f['affects_variant'] ?? false) === true);
        // No affects_variant field configured -> no valid options -> reject any provided types.
        $allowed = is_array($field['options'] ?? null) ? $field['options'] : [];
        $invalid = array_values(array_diff($types, $allowed));
        if (!empty($invalid)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'vehicle_types' => 'Tipos no válidos: ' . implode(', ', $invalid),
            ]);
        }
    }
}
