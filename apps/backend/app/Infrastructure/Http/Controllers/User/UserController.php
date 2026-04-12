<?php

namespace App\Infrastructure\Http\Controllers\User;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\UserResource;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = app('current_tenant_id');

        $users = UserModel::whereHas('tenants', function ($query) use ($tenantId) {
            $query->where('tenants.id', $tenantId);
        })->with(['tenants' => function ($query) use ($tenantId) {
            $query->where('tenants.id', $tenantId);
        }])->paginate($request->get('per_page', 15));

        return UserResource::collection($users);
    }

    public function show(string $id): UserResource
    {
        $user = UserModel::findOrFail($id);
        return new UserResource($user);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:8',
            'role' => 'required|in:tenant_admin,cashier,washer',
            'phone' => 'nullable|string|max:20',
        ]);

        $tenantId = app('current_tenant_id');

        // Check if user already exists
        $user = UserModel::where('email', $request->email)->first();

        if ($user) {
            // Check if already in this tenant
            $exists = TenantUserModel::where('tenant_id', $tenantId)
                ->where('user_id', $user->id)
                ->exists();

            if ($exists) {
                return response()->json([
                    'error' => ['code' => 'ALREADY_MEMBER', 'message' => 'Este usuario ya es miembro del equipo'],
                ], 422);
            }
        } else {
            // Create new user
            $user = UserModel::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => $request->password, // hashed by model cast
                'phone' => $request->phone,
                'is_super_admin' => false,
            ]);
        }

        // Link to tenant
        TenantUserModel::create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => $request->role,
            'is_active' => true,
        ]);

        return response()->json([
            'data' => ['message' => 'Miembro agregado exitosamente'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function updateRole(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'role' => 'required|in:tenant_admin,cashier,washer',
        ]);

        TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $id)
            ->update(['role' => $request->role]);

        return response()->json([
            'data' => ['message' => 'Role updated'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
