<?php

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Application\DTOs\Tenant\RegisterTenantDTO;
use App\Application\UseCases\Tenant\ActivateTenantUseCase;
use App\Application\UseCases\Tenant\RegisterTenantUseCase;
use App\Domain\Tenant\BusinessTypeTemplates;
use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Onboarding\RegisterTenantRequest;
use App\Infrastructure\Http\Resources\TenantResource;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
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

    public function setBusinessType(Request $request): JsonResponse
    {
        $request->validate([
            'business_type' => 'required|string|in:car_wash,barbershop,medical,spa,gym,other',
            'create_suggested_services' => 'nullable|boolean',
        ]);

        $tenantId = app('current_tenant_id');
        $businessType = $request->business_type;
        $createSuggestedServices = $request->boolean('create_suggested_services', true);

        $customFields = BusinessTypeTemplates::getCustomFields($businessType);
        $features = BusinessTypeTemplates::getDefaultFeatures($businessType);

        $tenant = TenantModel::findOrFail($tenantId);
        $tenant->update([
            'business_type' => $businessType,
            'custom_fields' => $customFields,
            'settings' => array_merge($tenant->settings ?? [], ['features' => $features]),
            'onboarding_step' => 3,
        ]);

        if ($createSuggestedServices) {
            $suggestedServices = BusinessTypeTemplates::getSuggestedServices($businessType);
            foreach ($suggestedServices as $index => $service) {
                ServiceModel::withoutGlobalScopes()->create([
                    'tenant_id' => $tenantId,
                    'name' => $service['name'],
                    'price' => $service['price'],
                    'description' => $service['description'],
                    'is_active' => true,
                    'sort_order' => $index + 1,
                ]);
            }
        }

        $tenant->refresh();

        return response()->json([
            'data' => new TenantResource($tenant),
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
