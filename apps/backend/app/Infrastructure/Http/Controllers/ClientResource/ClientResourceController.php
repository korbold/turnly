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
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
        $data = $request->data ?? [];
        $tenantId = app('current_tenant_id');

        // Resolve client: explicit client_id, or auto-create from client name in data
        $clientId = $request->client_id;

        if (!$clientId) {
            $clientName = $this->extractClientName($data);
            if ($clientName) {
                $client = $this->findOrCreateClient($clientName, $tenantId);
                $clientId = $client->id;
            } else {
                $clientId = $request->user()->id;
            }
        }

        $dto = new CreateClientResourceDTO(
            tenantId: $tenantId,
            clientId: $clientId,
            data: $data,
            plate: $request->plate ?? $data['plate'] ?? '',
            brand: $request->brand ?? $data['brand'] ?? null,
            model: $request->model ?? $data['model'] ?? null,
            color: $request->color ?? $data['color'] ?? null,
            type: $request->type ?? $data['type'] ?? 'sedan',
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

    public function update(Request $request, string $id): ClientResourceResource
    {
        $clientResource = ClientResourceModel::findOrFail($id);

        $request->validate([
            'data' => 'nullable|array',
        ]);

        $clientResource->update($request->only(['data']));

        return new ClientResourceResource($clientResource->load('client'));
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

    /**
     * Extract client name from data fields.
     * Looks for known keys that represent a client name.
     */
    private function extractClientName(array $data): ?string
    {
        // Check for common client name field patterns in custom fields
        $tenant = app('current_tenant');
        $customFields = $tenant->custom_fields ?? [];

        foreach ($customFields as $field) {
            $label = strtolower($field['label'] ?? '');
            if (str_contains($label, 'nombre') && str_contains($label, 'cliente')) {
                $key = $field['key'] ?? '';
                if (!empty($data[$key])) {
                    return $data[$key];
                }
            }
        }

        return null;
    }

    /**
     * Find existing client by name or create a new one.
     */
    private function findOrCreateClient(string $name, string $tenantId): UserModel
    {
        // Look for existing client with this name in the tenant
        $existing = UserModel::whereHas('tenants', function ($q) use ($tenantId) {
            $q->where('tenants.id', $tenantId)->where('tenant_users.role', 'client');
        })->where('name', $name)->first();

        if ($existing) {
            return $existing;
        }

        // Create new user with client role
        $user = UserModel::create([
            'name' => $name,
            'email' => Str::slug($name) . '-' . Str::random(4) . '@client.local',
            'password' => bcrypt(Str::random(16)),
        ]);

        TenantUserModel::create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => 'client',
            'is_active' => true,
        ]);

        return $user;
    }
}
