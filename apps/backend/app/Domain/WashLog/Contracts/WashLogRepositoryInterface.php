<?php

namespace App\Domain\WashLog\Contracts;

use App\Domain\WashLog\Entities\WashLog;

interface WashLogRepositoryInterface
{
    public function findById(string $id): ?WashLog;
    public function findByTenantAndDate(string $tenantId, string $date): array;
    public function save(WashLog $washLog): WashLog;
    public function complete(string $id, \DateTimeImmutable $finishedAt): void;
    public function getDailySummary(string $tenantId, string $date): array;
    public function paginate(int $perPage = 15, array $filters = []): array;
}
