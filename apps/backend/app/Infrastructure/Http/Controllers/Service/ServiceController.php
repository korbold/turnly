<?php

namespace App\Infrastructure\Http\Controllers\Service;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Service\CreateServiceRequest;
use App\Infrastructure\Http\Requests\Service\UpdateServiceRequest;
use App\Infrastructure\Http\Resources\ServiceResource;
use App\Infrastructure\Persistence\Models\ServiceModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index(Request $request)
    {
        $services = ServiceModel::orderBy('sort_order')
            ->paginate($request->get('per_page', 50));

        return ServiceResource::collection($services);
    }

    public function store(CreateServiceRequest $request): JsonResponse
    {
        $service = ServiceModel::create([
            'tenant_id' => app('current_tenant_id'),
            ...$request->validated(),
        ]);

        return (new ServiceResource($service))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateServiceRequest $request, string $id): ServiceResource
    {
        $service = ServiceModel::findOrFail($id);
        $service->update($request->validated());

        return new ServiceResource($service->fresh());
    }

    public function destroy(string $id): JsonResponse
    {
        $service = ServiceModel::findOrFail($id);
        $service->delete(); // soft delete

        return response()->json([
            'data' => ['message' => 'Service deleted'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
