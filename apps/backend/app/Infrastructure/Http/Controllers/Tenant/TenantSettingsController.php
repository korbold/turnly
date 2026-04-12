<?php

namespace App\Infrastructure\Http\Controllers\Tenant;

use App\Application\DTOs\Tenant\ConfigureBusinessDTO;
use App\Application\UseCases\Tenant\ConfigureBusinessUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\TenantResource;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Http\Request;

class TenantSettingsController extends Controller
{
    public function __construct(
        private ConfigureBusinessUseCase $configureBusiness,
    ) {}

    public function show(): TenantResource
    {
        $tenant = TenantModel::findOrFail(app('current_tenant_id'));
        return new TenantResource($tenant);
    }

    public function update(Request $request): TenantResource
    {
        $request->validate([
            'settings' => 'nullable|array',
            'onboarding_step' => 'nullable|integer|min:0',
        ]);

        $dto = new ConfigureBusinessDTO(
            tenantId: app('current_tenant_id'),
            settings: $request->settings,
            onboardingStep: $request->onboarding_step,
        );

        $this->configureBusiness->execute($dto);
        $tenant = TenantModel::findOrFail(app('current_tenant_id'));

        return new TenantResource($tenant);
    }
}
