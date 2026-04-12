<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\WashLog\Contracts\WashLogRepositoryInterface;
use App\Domain\WashLog\Entities\WashLog;
use App\Infrastructure\Persistence\Models\WashLogModel;
use Illuminate\Support\Str;

class EloquentWashLogRepository implements WashLogRepositoryInterface
{
    public function findById(string $id): ?WashLog
    {
        $model = WashLogModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByTenantAndDate(string $tenantId, string $date): array
    {
        return WashLogModel::whereDate('log_date', $date)
            ->orderBy('started_at')
            ->get()
            ->map(fn (WashLogModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(WashLog $washLog): WashLog
    {
        $model = WashLogModel::find($washLog->id);

        $data = [
            'tenant_id'      => $washLog->tenantId,
            'client_resource_id'     => $washLog->clientResourceId,
            'service_id'     => $washLog->serviceId,
            'reservation_id' => $washLog->reservationId,
            'attended_by'    => $washLog->attendedBy,
            'created_by'     => $washLog->createdBy,
            'started_at'     => $washLog->startedAt->format('Y-m-d H:i:s'),
            'finished_at'    => $washLog->finishedAt?->format('Y-m-d H:i:s'),
            'price_charged'  => $washLog->priceCharged,
            'payment_method' => $washLog->paymentMethod,
            'status'         => $washLog->status,
            'notes'          => $washLog->notes,
            'log_date'       => $washLog->logDate,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $washLog->id ?: (string) Str::uuid();
            $model = WashLogModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function complete(string $id, \DateTimeImmutable $finishedAt): void
    {
        WashLogModel::where('id', $id)->update([
            'status'      => 'completed',
            'finished_at' => $finishedAt->format('Y-m-d H:i:s'),
        ]);
    }

    public function getDailySummary(string $tenantId, string $date): array
    {
        $rows = WashLogModel::whereDate('log_date', $date)->get();

        $totalWashes  = $rows->count();
        $totalRevenue = $rows->sum('price_charged');

        $byPaymentMethod = [];
        foreach (['cash', 'card', 'transfer'] as $method) {
            $subset = $rows->where('payment_method', $method);
            $byPaymentMethod[$method] = [
                'count' => $subset->count(),
                'total' => (float) $subset->sum('price_charged'),
            ];
        }

        $byStatus = [
            'in_progress' => $rows->where('status', 'in_progress')->count(),
            'completed'   => $rows->where('status', 'completed')->count(),
        ];

        return [
            'total_washes'       => $totalWashes,
            'total_revenue'      => (float) $totalRevenue,
            'by_payment_method'  => $byPaymentMethod,
            'by_status'          => $byStatus,
        ];
    }

    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = WashLogModel::orderBy('started_at', 'desc');

        if (!empty($filters['date'])) {
            $query->whereDate('log_date', $filters['date']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['service_id'])) {
            $query->where('service_id', $filters['service_id']);
        }

        $paginator = $query->paginate($perPage);

        return [
            'data'         => $paginator->map(fn (WashLogModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(WashLogModel $model): WashLog
    {
        return new WashLog(
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
