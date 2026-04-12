<?php

namespace App\Application\UseCases\ServiceLog;

use App\Application\DTOs\ServiceLog\CreateServiceLogDTO;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Domain\ServiceLog\Entities\ServiceLog;
use Illuminate\Support\Str;

class CreateServiceLogUseCase
{
    public function __construct(
        private ServiceLogRepositoryInterface $serviceLogRepository,
    ) {}

    public function execute(CreateServiceLogDTO $dto): ServiceLog
    {
        $now = new \DateTimeImmutable();

        $serviceLog = new ServiceLog(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            clientResourceId: $dto->clientResourceId,
            serviceId: $dto->serviceId,
            reservationId: $dto->reservationId,
            attendedBy: $dto->attendedBy,
            createdBy: $dto->createdBy,
            startedAt: $now,
            finishedAt: null,
            priceCharged: $dto->priceCharged,
            paymentMethod: $dto->paymentMethod,
            status: 'in_progress',
            notes: $dto->notes,
            logDate: $now->format('Y-m-d'),
        );

        return $this->serviceLogRepository->save($serviceLog);
    }
}
