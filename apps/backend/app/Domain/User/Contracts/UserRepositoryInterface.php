<?php

namespace App\Domain\User\Contracts;

use App\Domain\User\Entities\User;

interface UserRepositoryInterface
{
    public function findById(string $id): ?User;
    public function findByEmail(string $email): ?User;
    public function save(User $user): User;
    public function findByTenant(string $tenantId, int $perPage = 15): array;
}
