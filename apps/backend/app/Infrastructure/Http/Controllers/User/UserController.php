<?php

namespace App\Infrastructure\Http\Controllers\User;

use App\Application\Services\PlanLimitsService;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\UserResource;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(
        private PlanLimitsService $planLimits,
    ) {}

    public function index(Request $request)
    {
        $tenantId = app('current_tenant_id');

        $query = UserModel::whereHas('tenants', function ($q) use ($tenantId, $request) {
            $q->where('tenants.id', $tenantId);
            if ($request->has('role')) {
                $q->where('tenant_users.role', $request->role);
            }
            if ($request->has('exclude_role')) {
                $q->where('tenant_users.role', '!=', $request->exclude_role);
            }
        })->with(['tenants' => function ($q) use ($tenantId) {
            $q->where('tenants.id', $tenantId);
        }]);

        $users = $query->paginate($request->get('per_page', 15));

        return UserResource::collection($users);
    }

    public function show(string $id): UserResource
    {
        $user = UserModel::findOrFail($id);
        return new UserResource($user);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'username' => ['required', 'string', 'min:3', 'max:60', 'regex:/^[a-z0-9._-]+$/', Rule::unique('users', 'username')],
            'password' => 'required|string|min:6',
            'email'    => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone'    => 'nullable|string|max:20',
            'role'     => 'required|in:tenant_admin,cashier,washer',
        ]);

        $tenantId = app('current_tenant_id');

        if (!$this->planLimits->canAddEmployee($tenantId)) {
            return response()->json([
                'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de empleados alcanzado. Actualiza tu plan.'],
            ], 403);
        }

        $user = UserModel::create([
            'name'     => $data['name'],
            'username' => strtolower($data['username']),
            'password' => $data['password'], // hashed by model cast
            'email'    => $data['email'] ?? null,
            'phone'    => $data['phone'] ?? null,
            'is_super_admin' => false,
            // Staff accounts created by admins are trusted: skip email verification.
            'email_verified_at' => now(),
        ]);

        TenantUserModel::create([
            'tenant_id' => $tenantId,
            'user_id'   => $user->id,
            'role'      => $data['role'],
            'is_active' => true,
        ]);

        return response()->json([
            'data' => [
                'user' => [
                    'id'       => $user->id,
                    'name'     => $user->name,
                    'username' => $user->username,
                    'email'    => $user->email,
                    'role'     => $data['role'],
                ],
                'message' => 'Miembro creado exitosamente',
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function updateRole(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'role' => 'required|in:tenant_admin,cashier,washer,client',
        ]);

        TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $id)
            ->update(['role' => $request->role]);

        return response()->json([
            'data' => ['message' => 'Role updated'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function resetPassword(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'password' => 'required|string|min:6|max:255',
        ]);

        $tenantId = app('current_tenant_id');

        // Only allow resetting passwords of users that belong to the current tenant.
        $belongs = TenantUserModel::where('tenant_id', $tenantId)
            ->where('user_id', $id)
            ->exists();

        if (!$belongs) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Miembro no encontrado'],
            ], 404);
        }

        $user = UserModel::findOrFail($id);
        $user->password = Hash::make($data['password']);
        $user->save();

        // Invalidate any active sessions so the old password stops working.
        $user->tokens()->delete();

        return response()->json([
            'data' => ['message' => 'Contraseña actualizada'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
