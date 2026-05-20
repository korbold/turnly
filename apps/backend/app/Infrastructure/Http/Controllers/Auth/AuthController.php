<?php

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Application\Services\EmailVerificationService;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Auth\LoginRequest;
use App\Infrastructure\Http\Requests\Auth\RegisterRequest;
use App\Infrastructure\Http\Requests\Auth\VerifyEmailRequest;
use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(private EmailVerificationService $verification) {}

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
                    'trial_ends_at' => now()->addDays(30),
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

        $this->verification->issueAndSend($result['user']);

        $token = $result['user']->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'email_verified' => false,
                    'terms_accepted_at' => $result['user']->terms_accepted_at?->toIso8601String(),
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

        $tenantUser = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();

        $tenant = $tenantUser?->tenant;

        if ($tenant && $tenant->status === 'suspended' && !$user->is_super_admin) {
            return response()->json([
                'error' => [
                    'code' => 'TENANT_SUSPENDED',
                    'message' => 'Este negocio está suspendido. Contacta soporte.',
                ],
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->is_super_admin,
                    'email_verified' => $user->email_verified_at !== null,
                    'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                ],
                'token' => $token,
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
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

    public function verifyEmail(VerifyEmailRequest $request): JsonResponse
    {
        $user = UserModel::where('email', $request->string('email')->toString())->firstOrFail();

        if ($user->email_verified_at !== null) {
            return response()->json([
                'data' => ['message' => 'Email ya verificado'],
            ]);
        }

        $result = $this->verification->verify($user, $request->string('code')->toString());

        if (!$result['ok']) {
            $statusByReason = [
                'EXPIRED' => 410,
                'LOCKED' => 429,
                'NO_CODE' => 410,
                'INVALID' => 422,
            ];
            $messageByReason = [
                'EXPIRED' => 'El código expiró. Solicita uno nuevo.',
                'LOCKED' => 'Demasiados intentos. Solicita un nuevo código.',
                'NO_CODE' => 'No hay código activo. Solicita uno nuevo.',
                'INVALID' => 'Código incorrecto.',
            ];
            $reason = $result['reason'] ?? 'INVALID';
            return response()->json([
                'error' => [
                    'code' => $reason,
                    'message' => $messageByReason[$reason] ?? 'Código inválido.',
                ],
            ], $statusByReason[$reason] ?? 422);
        }

        // Activate tenant if it was pending awaiting email verification.
        $tenantUser = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();
        if ($tenantUser && $tenantUser->tenant && $tenantUser->tenant->status === 'pending') {
            $tenantUser->tenant->update([
                'status' => 'active',
                'activated_at' => now(),
            ]);
        }

        // Issue a fresh login token now that the email is verified.
        $token = $user->createToken('auth_token')->plainTextToken;
        $tenantUserActive = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();
        $tenant = $tenantUserActive?->tenant;

        $freshUser = $user->fresh();

        return response()->json([
            'data' => [
                'message' => 'Email verificado',
                'email_verified_at' => $freshUser->email_verified_at?->toIso8601String(),
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => (bool) $user->is_super_admin,
                    'terms_accepted_at' => $freshUser->terms_accepted_at?->toIso8601String(),
                ],
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                ] : null,
            ],
        ]);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
        ]);

        $user = UserModel::where('email', $request->string('email')->toString())->first();

        if (!$user || $user->email_verified_at !== null) {
            // Always 200 to avoid disclosing account state.
            return response()->json([
                'data' => ['message' => 'Si el email existe y no está verificado, te llegará un código.'],
            ]);
        }

        $key = 'verify-email:resend:' . $user->id;
        if (RateLimiter::tooManyAttempts($key, 1)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'error' => [
                    'code' => 'RATE_LIMITED',
                    'message' => "Espera {$seconds}s antes de reenviar.",
                    'retry_after' => $seconds,
                ],
            ], 429);
        }
        RateLimiter::hit($key, 60);

        $this->verification->issueAndSend($user);

        return response()->json([
            'data' => ['message' => 'Código reenviado'],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = app()->has('current_tenant_id') ? app('current_tenant_id') : null;

        $tenantUser = $tenantId
            ? TenantUserModel::where('user_id', $user->id)
                ->where('tenant_id', $tenantId)
                ->with('tenant')
                ->first()
            : TenantUserModel::where('user_id', $user->id)
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
                    'role' => $tenantUser?->role,
                    'email_verified' => $user->email_verified_at !== null,
                    'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                ],
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                ] : null,
            ],
        ]);
    }

    public function acceptTerms(Request $request): JsonResponse
    {
        $request->validate([
            'version' => ['required', 'string', 'max:10'],
        ]);

        $request->user()->update([
            'terms_accepted_at' => now(),
            'terms_version_accepted' => $request->string('version')->toString(),
        ]);

        $user = $request->user()->fresh();

        return response()->json([
            'data' => [
                'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                'terms_version_accepted' => $user->terms_version_accepted,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
