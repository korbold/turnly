<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Vehicle\Contracts\VehicleRepositoryInterface;
use App\Domain\Vehicle\Entities\Vehicle;
use App\Domain\WashLog\Entities\WashLog;
use App\Infrastructure\Persistence\Models\VehicleModel;
use App\Infrastructure\Persistence\Models\WashLogModel;
use Illuminate\Support\Str;

class EloquentVehicleRepository implements VehicleRepositoryInterface
{
    public function findById(string $id): ?Vehicle
    {
        $model = VehicleModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByPlate(string $tenantId, string $plate): ?Vehicle
    {
        $model = VehicleModel::where('plate', $plate)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByOwner(string $ownerId): array
    {
        return VehicleModel::where('owner_id', $ownerId)
            ->get()
            ->map(fn (VehicleModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(Vehicle $vehicle): Vehicle
    {
        $model = VehicleModel::find($vehicle->id);

        $data = [
            'tenant_id' => $vehicle->tenantId,
            'owner_id'  => $vehicle->ownerId,
            'plate'     => $vehicle->plate,
            'brand'     => $vehicle->brand,
            'model'     => $vehicle->model,
            'color'     => $vehicle->color,
            'type'      => $vehicle->type,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $vehicle->id ?: (string) Str::uuid();
            $model = VehicleModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function getHistory(string $vehicleId): array
    {
        return WashLogModel::where('vehicle_id', $vehicleId)
            ->orderBy('started_at', 'desc')
            ->get()
            ->map(fn (WashLogModel $m) => $this->mapWashLogToEntity($m))
            ->all();
    }

    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = VehicleModel::orderBy('created_at', 'desc');

        if (!empty($filters['owner_id'])) {
            $query->where('owner_id', $filters['owner_id']);
        }

        if (!empty($filters['plate'])) {
            $query->where('plate', 'like', '%' . $filters['plate'] . '%');
        }

        $paginator = $query->paginate($perPage);

        return [
            'data'         => $paginator->map(fn (VehicleModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(VehicleModel $model): Vehicle
    {
        return new Vehicle(
            id: $model->id,
            tenantId: $model->tenant_id,
            ownerId: $model->owner_id,
            plate: $model->plate,
            brand: $model->brand,
            model: $model->model,
            color: $model->color,
            type: $model->type,
        );
    }

    private function mapWashLogToEntity(WashLogModel $model): WashLog
    {
        return new WashLog(
            id: $model->id,
            tenantId: $model->tenant_id,
            vehicleId: $model->vehicle_id,
            serviceId: $model->service_id,
            reservationId: $model->reservation_id,
            attendedBy: $model->attended_by,
            createdBy: $model->created_by,
            startedAt: \DateTimeImmutable::createFromMutable($model->started_at->toDateTime()),
            finishedAt: $model->finished_at
                ? \DateTimeImmutable::createFromMutable($model->finished_at->toDateTime())
                : null,
            priceCharged: (float) $model->price_charged,
            paymentMethod: $model->payment_method,
            status: $model->status,
            notes: $model->notes,
            logDate: $model->log_date instanceof \Carbon\Carbon
                ? $model->log_date->format('Y-m-d')
                : (string) $model->log_date,
        );
    }
}
