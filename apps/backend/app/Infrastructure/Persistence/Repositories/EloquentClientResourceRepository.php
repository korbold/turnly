<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\ClientResource\Contracts\ClientResourceRepositoryInterface;
use App\Domain\ClientResource\Entities\ClientResource;
use App\Domain\ServiceLog\Entities\ServiceLog;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Support\Str;

class EloquentClientResourceRepository implements ClientResourceRepositoryInterface
{
    public function findById(string $id): ?ClientResource
    {
        $model = ClientResourceModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByPlate(string $tenantId, string $plate): ?ClientResource
    {
        $model = ClientResourceModel::where('plate', $plate)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByClient(string $clientId): array
    {
        return ClientResourceModel::where('client_id', $clientId)
            ->get()
            ->map(fn (ClientResourceModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(ClientResource $clientResource): ClientResource
    {
        $model = ClientResourceModel::find($clientResource->id);

        $data = [
            'tenant_id'  => $clientResource->tenantId,
            'client_id'  => $clientResource->clientId,
            'data'       => $clientResource->data,
            'plate'      => $clientResource->plate,
            'brand'      => $clientResource->brand,
            'model'      => $clientResource->model,
            'color'      => $clientResource->color,
            'type'       => $clientResource->type,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $clientResource->id ?: (string) Str::uuid();
            $model = ClientResourceModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function getHistory(string $clientResourceId): array
    {
        return ServiceLogModel::where('client_resource_id', $clientResourceId)
            ->orderBy('started_at', 'desc')
            ->get()
            ->map(fn (ServiceLogModel $m) => $this->mapServiceLogToEntity($m))
            ->all();
    }

    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = ClientResourceModel::orderBy('created_at', 'desc');

        if (!empty($filters['client_id'])) {
            $query->where('client_id', $filters['client_id']);
        }

        if (!empty($filters['plate'])) {
            $query->where('plate', 'like', '%' . $filters['plate'] . '%');
        }

        $paginator = $query->paginate($perPage);

        return [
            'data'         => $paginator->map(fn (ClientResourceModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(ClientResourceModel $model): ClientResource
    {
        return new ClientResource(
            id: $model->id,
            tenantId: $model->tenant_id,
            clientId: $model->client_id,
            data: $model->data,
            plate: $model->plate,
            brand: $model->brand,
            model: $model->model,
            color: $model->color,
            type: $model->type,
        );
    }

    private function mapServiceLogToEntity(ServiceLogModel $model): ServiceLog
    {
        return new ServiceLog(
            id: $model->id,
            tenantId: $model->tenant_id,
            clientResourceId: $model->client_resource_id,
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
