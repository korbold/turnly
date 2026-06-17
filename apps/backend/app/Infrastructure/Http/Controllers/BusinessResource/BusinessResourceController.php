<?php

namespace App\Infrastructure\Http\Controllers\BusinessResource;

use App\Application\DTOs\BusinessResource\BusinessResourceDTO;
use App\Application\UseCases\BusinessResource\CreateBusinessResourceUseCase;
use App\Application\UseCases\BusinessResource\DeleteBusinessResourceUseCase;
use App\Application\UseCases\BusinessResource\UpdateBusinessResourceUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\BusinessResourceResource;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class BusinessResourceController extends Controller
{
    public function __construct(
        private CreateBusinessResourceUseCase $create,
        private UpdateBusinessResourceUseCase $update,
        private DeleteBusinessResourceUseCase $delete,
    ) {}

    public function index(Request $request): ResourceCollection
    {
        $tenantId = app('current_tenant_id');
        $models = BusinessResourceModel::forTenant($tenantId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return BusinessResourceResource::collection($models);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'employee_id' => 'nullable|uuid|exists:users,id',
            'type'        => 'sometimes|in:physical,person',
            'is_active'   => 'sometimes|boolean',
            'sort_order'  => 'sometimes|integer|min:0',
        ]);

        $tenantId = app('current_tenant_id');
        $dto = new BusinessResourceDTO(
            name: $data['name'],
            description: $data['description'] ?? null,
            employeeId: $data['employee_id'] ?? null,
            type: $data['type'] ?? 'physical',
            isActive: $data['is_active'] ?? true,
            sortOrder: $data['sort_order'] ?? 0,
        );

        $resource = $this->create->execute($tenantId, $dto);

        $model = BusinessResourceModel::withoutGlobalScopes()->find($resource->id);

        return (new BusinessResourceResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'employee_id' => 'nullable|uuid|exists:users,id',
            'type'        => 'sometimes|in:physical,person',
            'is_active'   => 'sometimes|boolean',
            'sort_order'  => 'sometimes|integer|min:0',
        ]);

        $existing = BusinessResourceModel::findOrFail($id);

        $dto = new BusinessResourceDTO(
            name: $data['name'] ?? $existing->name,
            description: array_key_exists('description', $data) ? $data['description'] : $existing->description,
            employeeId: array_key_exists('employee_id', $data) ? $data['employee_id'] : $existing->employee_id,
            type: $data['type'] ?? $existing->type,
            isActive: $data['is_active'] ?? $existing->is_active,
            sortOrder: $data['sort_order'] ?? $existing->sort_order,
        );

        $resource = $this->update->execute($id, $dto);

        $model = BusinessResourceModel::withoutGlobalScopes()->find($resource->id);

        return response()->json(['data' => new BusinessResourceResource($model)]);
    }

    public function destroy(string $id): JsonResponse
    {
        BusinessResourceModel::findOrFail($id); // TenantScope ensures tenant ownership
        $this->delete->execute($id);

        return response()->json(null, 204);
    }
}
