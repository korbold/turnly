<?php

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Application\DTOs\Tenant\RegisterTenantDTO;
use App\Application\UseCases\Tenant\ActivateTenantUseCase;
use App\Application\UseCases\Tenant\RegisterTenantUseCase;
use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Onboarding\RegisterTenantRequest;
use App\Infrastructure\Http\Resources\TenantResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    public function __construct(
        private RegisterTenantUseCase $registerTenant,
        private ActivateTenantUseCase $activateTenant,
        private TenantRepositoryInterface $tenantRepository,
    ) {}

    public function register(RegisterTenantRequest $request): JsonResponse
    {
        $dto = RegisterTenantDTO::fromArray($request->validated());
        $result = $this->registerTenant->execute($dto);

        $token = $result['user']->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'tenant' => [
                    'id' => $result['tenant']->id,
                    'slug' => $result['tenant']->slug,
                    'name' => $result['tenant']->name,
                ],
                'token' => $token,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function verify(Request $request): JsonResponse
    {
        // For MVP, simple token-based verification
        // In production, this would validate an email token
        $request->validate(['tenant_id' => 'required|uuid']);

        $tenant = $this->activateTenant->execute($request->tenant_id);

        return response()->json([
            'data' => ['message' => 'Tenant activated successfully'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function checkSlug(Request $request): JsonResponse
    {
        $request->validate(['slug' => 'required|string|max:100']);

        $available = !$this->tenantRepository->slugExists($request->slug);

        return response()->json([
            'data' => ['available' => $available],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
