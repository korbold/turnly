<?php

namespace App\Infrastructure\Http\Controllers\SuperAdmin;

use App\Application\UseCases\Tenant\ActivateTenantUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\TenantResource;
use App\Infrastructure\Http\Resources\UserResource;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
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

    public function users(Request $request)
    {
        $users = UserModel::with(['tenants' => function ($q) {
            $q->select('tenants.id', 'tenants.name', 'tenants.slug');
        }])
        ->orderBy('created_at', 'desc')
        ->paginate($request->get('per_page', 15));

        return UserResource::collection($users);
    }

    public function stats(): JsonResponse
    {
        $stats = [
            'total_tenants' => TenantModel::count(),
            'active_tenants' => TenantModel::where('status', 'active')->count(),
            'total_users' => UserModel::count(),
            'total_reservations' => ReservationModel::withoutGlobalScopes()->count(),
            'total_services' => ServiceModel::withoutGlobalScopes()->count(),
        ];

        return response()->json([
            'data' => $stats,
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
