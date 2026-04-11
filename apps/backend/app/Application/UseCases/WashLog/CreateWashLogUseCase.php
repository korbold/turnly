<?php

namespace App\Application\UseCases\WashLog;

use App\Application\DTOs\WashLog\CreateWashLogDTO;
use App\Domain\WashLog\Contracts\WashLogRepositoryInterface;
use App\Domain\WashLog\Entities\WashLog;
use Illuminate\Support\Str;

class CreateWashLogUseCase
{
    public function __construct(
        private WashLogRepositoryInterface $washLogRepository,
    ) {}

    public function execute(CreateWashLogDTO $dto): WashLog
    {
        $now = new \DateTimeImmutable();

        $washLog = new WashLog(
            id: (string) Str::uuid(),
            tenantId: $dto->tenantId,
            vehicleId: $dto->vehicleId,
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

        return $this->washLogRepository->save($washLog);
    }
}
