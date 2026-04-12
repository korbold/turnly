<?php

namespace App\Infrastructure\Http\Controllers\Vehicle;

use App\Application\DTOs\Vehicle\CreateVehicleDTO;
use App\Application\UseCases\Vehicle\CreateVehicleUseCase;
use App\Application\UseCases\Vehicle\GetVehicleHistoryUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Vehicle\CreateVehicleRequest;
use App\Infrastructure\Http\Resources\VehicleResource;
use App\Infrastructure\Http\Resources\WashLogResource;
use App\Infrastructure\Persistence\Models\VehicleModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function __construct(
        private CreateVehicleUseCase $createVehicle,
        private GetVehicleHistoryUseCase $getVehicleHistory,
    ) {}

    public function index(Request $request)
    {
        $vehicles = VehicleModel::with('owner')
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return VehicleResource::collection($vehicles);
    }

    public function store(CreateVehicleRequest $request): JsonResponse
    {
        $dto = new CreateVehicleDTO(
            tenantId: app('current_tenant_id'),
            ownerId: $request->user()->id,
            plate: $request->plate,
            brand: $request->brand,
            model: $request->model,
            color: $request->color,
            type: $request->type ?? 'sedan',
        );

        $vehicle = $this->createVehicle->execute($dto);
        $model = VehicleModel::with('owner')->find($vehicle->id);

        return (new VehicleResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): VehicleResource
    {
        $vehicle = VehicleModel::with('owner')->findOrFail($id);
        return new VehicleResource($vehicle);
    }

    public function history(string $id): JsonResponse
    {
        $history = $this->getVehicleHistory->execute($id);

        return response()->json([
            'data' => $history,
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
