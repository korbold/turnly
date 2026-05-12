<?php

namespace App\Application\UseCases\ServiceLog;

use App\Application\DTOs\ServiceLog\UpdateServiceLogDTO;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Domain\ServiceLog\Entities\ServiceLog;
use App\Domain\ServiceLog\Exceptions\ServiceLogNotFoundException;
use App\Infrastructure\Persistence\Models\ServiceLogModel;

class UpdateServiceLogUseCase
{
    public function __construct(
        private ServiceLogRepositoryInterface $serviceLogRepository,
    ) {}

    public function execute(UpdateServiceLogDTO $dto): ServiceLog
    {
        $serviceLog = $this->serviceLogRepository->findById($dto->id);

        if (!$serviceLog) {
            throw new ServiceLogNotFoundException();
        }

        $updates = [];
        if ($dto->notes !== null) {
            $updates['notes'] = $dto->notes;
        }
        if ($dto->paymentMethod !== null) {
            $updates['payment_method'] = $dto->paymentMethod;
        }
        if ($dto->priceCharged !== null) {
            $updates['price_charged'] = $dto->priceCharged;
        }

        if (!empty($updates)) {
            // Keep the global TenantScope on so a stray cross-tenant id
            // can never be updated even if the prior findById is bypassed.
            ServiceLogModel::where('id', $dto->id)->update($updates);
        }

        return $this->serviceLogRepository->findById($dto->id);
    }
}
