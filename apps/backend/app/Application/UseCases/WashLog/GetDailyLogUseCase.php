<?php

namespace App\Application\UseCases\WashLog;

use App\Domain\WashLog\Contracts\WashLogRepositoryInterface;

class GetDailyLogUseCase
{
    public function __construct(
        private WashLogRepositoryInterface $washLogRepository,
    ) {}

    public function execute(string $tenantId, string $date): array
    {
        $logs = $this->washLogRepository->findByTenantAndDate($tenantId, $date);
        $summary = $this->washLogRepository->getDailySummary($tenantId, $date);

        return [
            'logs' => $logs,
            'summary' => $summary,
        ];
    }
}
