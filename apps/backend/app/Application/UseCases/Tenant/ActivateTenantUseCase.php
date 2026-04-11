<?php

namespace App\Application\UseCases\Tenant;

use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Domain\Tenant\Entities\Tenant;
use App\Domain\Tenant\Exceptions\TenantNotFoundException;
use App\Infrastructure\Persistence\Models\TenantModel;

class ActivateTenantUseCase
{
    public function __construct(
        private TenantRepositoryInterface $tenantRepository,
    ) {}

    public function execute(string $tenantId): Tenant
    {
        $tenant = $this->tenantRepository->findById($tenantId);

        if (!$tenant) {
            throw new TenantNotFoundException($tenantId);
        }

        // Update status to active and set activated_at
        TenantModel::where('id', $tenantId)->update([
            'status' => 'active',
            'activated_at' => now(),
        ]);

        return $this->tenantRepository->findById($tenantId);
    }
}
