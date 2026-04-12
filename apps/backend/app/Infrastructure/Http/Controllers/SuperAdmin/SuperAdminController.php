<?php

namespace App\Infrastructure\Http\Controllers\SuperAdmin;

use App\Application\UseCases\Tenant\ActivateTenantUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\TenantResource;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SuperAdminController extends Controller
{
    public function __construct(
        private ActivateTenantUseCase $activateTenant,
    ) {}

    public function index(Request $request)
    {
        $tenants = TenantModel::orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return TenantResource::collection($tenants);
    }

    public function suspend(string $id): JsonResponse
    {
        TenantModel::where('id', $id)->update(['status' => 'suspended']);

        return response()->json([
            'data' => ['message' => 'Tenant suspended'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function activate(string $id): JsonResponse
    {
        $this->activateTenant->execute($id);

        return response()->json([
            'data' => ['message' => 'Tenant activated'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
