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
