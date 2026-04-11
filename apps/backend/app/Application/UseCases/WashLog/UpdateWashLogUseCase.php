<?php

namespace App\Application\UseCases\WashLog;

use App\Application\DTOs\WashLog\UpdateWashLogDTO;
use App\Domain\WashLog\Contracts\WashLogRepositoryInterface;
use App\Domain\WashLog\Entities\WashLog;
use App\Domain\WashLog\Exceptions\WashLogNotFoundException;
use App\Infrastructure\Persistence\Models\WashLogModel;

class UpdateWashLogUseCase
{
    public function __construct(
        private WashLogRepositoryInterface $washLogRepository,
    ) {}

    public function execute(UpdateWashLogDTO $dto): WashLog
    {
        $washLog = $this->washLogRepository->findById($dto->id);

        if (!$washLog) {
            throw new WashLogNotFoundException();
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
            WashLogModel::withoutGlobalScopes()->where('id', $dto->id)->update($updates);
        }

        return $this->washLogRepository->findById($dto->id);
    }
}
