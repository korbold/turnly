<?php

namespace App\Domain\ServiceLog\Contracts;

use App\Domain\ServiceLog\Entities\ServiceLog;

interface ServiceLogRepositoryInterface
{
    public function findById(string $id): ?ServiceLog;
    public function findByTenantAndDate(string $tenantId, string $date): array;
    public function save(ServiceLog $serviceLog): ServiceLog;
    public function complete(string $id, \DateTimeImmutable $finishedAt): void;
    public function getDailySummary(string $tenantId, string $date): array;
    public function paginate(int $perPage = 15, array $filters = []): array;
}
