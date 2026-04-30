<?php

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Auth\LoginRequest;
use App\Infrastructure\Http\Requests\Auth\RegisterRequest;
use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = DB::transaction(function () use ($request) {
            $user = UserModel::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => $request->password,
                'phone' => $request->phone,
            ]);

            $tenant = null;
            if ($request->filled('business_name')) {
                $businessName = $request->business_name;
                $baseSlug = Str::slug($businessName) ?: 'negocio';
                $slug = $baseSlug;
                $i = 1;
                while (TenantModel::where('slug', $slug)->exists()) {
                    $slug = $baseSlug.'-'.$i++;
                }

                $defaultPlan = PlanModel::where('slug', 'free')->first();

                $tenant = TenantModel::create([
                    'id' => (string) Str::uuid(),
                    'slug' => $slug,
                    'name' => $businessName,
                    'owner_name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'country' => 'EC',
                    'business_type' => $request->business_type,
                    'plan_id' => $defaultPlan?->id,
                    'is_trial' => true,
                    'trial_ends_at' => now()->addDays(14),
                    'status' => 'pending',
                    'onboarding_step' => 0,
                ]);

                TenantUserModel::create([
                    'tenant_id' => $tenant->id,
                    'user_id' => $user->id,
                    'role' => 'tenant_admin',
                    'is_active' => true,
                ]);
            }

            return ['user' => $user, 'tenant' => $tenant];
        });

        $token = $result['user']->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                ],
                'tenant' => $result['tenant'] ? [
                    'id' => $result['tenant']->id,
                    'slug' => $result['tenant']->slug,
                    'name' => $result['tenant']->name,
                    'owner_name' => $result['tenant']->owner_name,
                    'email' => $result['tenant']->email,
                    'phone' => $result['tenant']->phone,
                    'country' => $result['tenant']->country,
                    'plan_id' => $result['tenant']->plan_id,
                    'is_trial' => (bool) $result['tenant']->is_trial,
                    'status' => $result['tenant']->status,
                    'trial_ends_at' => $result['tenant']->trial_ends_at?->toIso8601String(),
                    'onboarding_step' => $result['tenant']->onboarding_step,
                    'created_at' => $result['tenant']->created_at?->toIso8601String(),
                ] : null,
                'token' => $token,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = UserModel::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'error' => [
                    'code' => 'INVALID_CREDENTIALS',
                    'message' => 'Invalid email or password',
                ],
            ], 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        // Get the user's first active tenant
        $tenantUser = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();

        $tenant = $tenantUser?->tenant;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->is_super_admin,
                ],
                'token' => $token,
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                ] : null,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'data' => ['message' => 'Logged out successfully'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = app()->has('current_tenant_id') ? app('current_tenant_id') : null;

        $tenantUser = $tenantId
            ? TenantUserModel::where('user_id', $user->id)
                ->where('tenant_id', $tenantId)
                ->first()
            : null;

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_super_admin' => $user->is_super_admin,
                'role' => $tenantUser?->role,
            ],
        ]);
    }
}
