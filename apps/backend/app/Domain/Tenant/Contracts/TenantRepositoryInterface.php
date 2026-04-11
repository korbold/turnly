<?php

namespace App\Domain\Tenant\Contracts;

use App\Domain\Tenant\Entities\Tenant;

interface TenantRepositoryInterface
{
    public function findById(string $id): ?Tenant;
    public function findBySlug(string $slug): ?Tenant;
    public function findByEmail(string $email): ?Tenant;
    public function slugExists(string $slug): bool;
    public function save(Tenant $tenant): Tenant;
    public function updateStatus(string $id, string $status): void;
    public function updateSettings(string $id, array $settings): void;
    public function all(int $perPage = 15): array;
}
