<?php

namespace App\Application\UseCases\ServiceLog;

use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;

class GetDailyLogUseCase
{
    public function __construct(
        private ServiceLogRepositoryInterface $serviceLogRepository,
    ) {}

    public function execute(string $tenantId, string $date): array
    {
        $logs = $this->serviceLogRepository->findByTenantAndDate($tenantId, $date);
        $summary = $this->serviceLogRepository->getDailySummary($tenantId, $date);

        return [
            'logs' => $logs,
            'summary' => $summary,
        ];
    }
}
