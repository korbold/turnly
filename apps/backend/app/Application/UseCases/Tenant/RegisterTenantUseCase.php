<?php

namespace App\Application\UseCases\Tenant;

use App\Application\DTOs\Tenant\RegisterTenantDTO;
use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Domain\Tenant\Entities\Tenant;
use App\Domain\Tenant\Exceptions\TenantSlugTakenException;
use App\Domain\User\Contracts\UserRepositoryInterface;
use App\Domain\User\Entities\User;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegisterTenantUseCase
{
    public function __construct(
        private TenantRepositoryInterface $tenantRepository,
    ) {}

    public function execute(RegisterTenantDTO $dto): array
    {
        // Check slug uniqueness
        if ($this->tenantRepository->slugExists($dto->slug)) {
            throw new TenantSlugTakenException($dto->slug);
        }

        // Create tenant (domain entity)
        $tenant = new Tenant(
            id: (string) Str::uuid(),
            slug: $dto->slug,
            name: $dto->name,
            ownerName: $dto->ownerName,
            email: $dto->email,
            phone: $dto->phone,
            city: $dto->city,
            country: $dto->country,
            planId: null,
            isTrial: true,
            status: 'pending',
            trialEndsAt: new \DateTimeImmutable('+30 days'),
            settings: null,
            onboardingStep: 0,
            activatedAt: null,
        );

        $savedTenant = $this->tenantRepository->save($tenant);

        // Create owner user via Eloquent (we need the password hashing)
        $user = UserModel::create([
            'name' => $dto->ownerName,
            'email' => $dto->email,
            'password' => $dto->password, // hashed by model cast
            'phone' => $dto->phone,
            'is_super_admin' => false,
        ]);

        // Create tenant_user pivot
        TenantUserModel::create([
            'tenant_id' => $savedTenant->id,
            'user_id' => $user->id,
            'role' => 'tenant_admin',
            'is_active' => true,
        ]);

        return [
            'tenant' => $savedTenant,
            'user' => $user,
        ];
    }
}
