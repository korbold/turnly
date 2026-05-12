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
        $tenants = TenantModel::with('plan')
            ->orderBy('created_at', 'desc')
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

    public function impersonate(string $id): JsonResponse
    {
        $tenant = TenantModel::findOrFail($id);

        $user = UserModel::whereHas('tenants', function ($q) use ($id) {
            $q->where('tenants.id', $id)->where('role', 'owner');
        })->first();

        if (! $user) {
            $user = UserModel::whereHas('tenants', function ($q) use ($id) {
                $q->where('tenants.id', $id);
            })->first();
        }

        if (! $user) {
            return response()->json(['error' => ['message' => 'No users found for this tenant']], 404);
        }

        $user->tokens()->where('name', 'impersonate')->delete();
        $token = $user->createToken('impersonate')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => false,
                    'email_verified' => $user->email_verified_at !== null,
                ],
                'token' => $token,
                'tenant' => [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                ],
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function assignPlan(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
        ]);

        $tenant = TenantModel::findOrFail($id);
        $tenant->update([
            'plan_id' => $request->plan_id,
            'is_trial' => false,
        ]);

        return response()->json([
            'data' => ['message' => 'Plan assigned'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
