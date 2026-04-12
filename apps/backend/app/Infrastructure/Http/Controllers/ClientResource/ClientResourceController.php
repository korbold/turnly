<?php

namespace App\Infrastructure\Http\Controllers\ClientResource;

use App\Application\DTOs\ClientResource\CreateClientResourceDTO;
use App\Application\UseCases\ClientResource\CreateClientResourceUseCase;
use App\Application\UseCases\ClientResource\GetClientResourceHistoryUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\ClientResource\CreateClientResourceRequest;
use App\Infrastructure\Http\Resources\ClientResourceResource;
use App\Infrastructure\Http\Resources\ServiceLogResource;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientResourceController extends Controller
{
    public function __construct(
        private CreateClientResourceUseCase $createClientResource,
        private GetClientResourceHistoryUseCase $getClientResourceHistory,
    ) {}

    public function index(Request $request)
    {
        $clientResources = ClientResourceModel::with('client')
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return ClientResourceResource::collection($clientResources);
    }

    public function store(CreateClientResourceRequest $request): JsonResponse
    {
        $dto = new CreateClientResourceDTO(
            tenantId: app('current_tenant_id'),
            clientId: $request->user()->id,
            label: $request->label,
            data: $request->data,
            plate: $request->plate ?? '',
            brand: $request->brand,
            model: $request->model,
            color: $request->color,
            type: $request->type ?? 'sedan',
        );

        $clientResource = $this->createClientResource->execute($dto);
        $model = ClientResourceModel::with('client')->find($clientResource->id);

        return (new ClientResourceResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): ClientResourceResource
    {
        $clientResource = ClientResourceModel::with('client')->findOrFail($id);
        return new ClientResourceResource($clientResource);
    }

    public function history(string $id): JsonResponse
    {
        $history = $this->getClientResourceHistory->execute($id);

        return response()->json([
            'data' => $history,
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
