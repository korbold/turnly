<?php

namespace App\Application\UseCases\Tenant;

use App\Application\DTOs\Tenant\ConfigureBusinessDTO;
use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Domain\Tenant\Entities\Tenant;
use App\Domain\Tenant\Exceptions\TenantNotFoundException;
use App\Infrastructure\Persistence\Models\TenantModel;

class ConfigureBusinessUseCase
{
    public function __construct(
        private TenantRepositoryInterface $tenantRepository,
    ) {}

    public function execute(ConfigureBusinessDTO $dto): Tenant
    {
        $tenant = $this->tenantRepository->findById($dto->tenantId);

        if (!$tenant) {
            throw new TenantNotFoundException($dto->tenantId);
        }

        $updates = [];

        if ($dto->settings !== null) {
            // Merge with existing settings
            $existingSettings = $tenant->settings ?? [];
            $updates['settings'] = array_merge($existingSettings, $dto->settings);
        }

        if ($dto->onboardingStep !== null) {
            $updates['onboarding_step'] = $dto->onboardingStep;
        }

        if (!empty($updates)) {
            TenantModel::where('id', $dto->tenantId)->update($updates);
        }

        return $this->tenantRepository->findById($dto->tenantId);
    }
}
