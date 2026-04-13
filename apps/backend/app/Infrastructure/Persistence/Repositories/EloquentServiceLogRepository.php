<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Domain\ServiceLog\Entities\ServiceLog;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Support\Str;

class EloquentServiceLogRepository implements ServiceLogRepositoryInterface
{
    public function findById(string $id): ?ServiceLog
    {
        $model = ServiceLogModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByTenantAndDate(string $tenantId, string $date): array
    {
        return ServiceLogModel::whereDate('log_date', $date)
            ->orderBy('started_at')
            ->get()
            ->map(fn (ServiceLogModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(ServiceLog $serviceLog): ServiceLog
    {
        $model = ServiceLogModel::find($serviceLog->id);

        $data = [
            'tenant_id'      => $serviceLog->tenantId,
            'client_resource_id'     => $serviceLog->clientResourceId,
            'service_id'     => $serviceLog->serviceId,
            'reservation_id' => $serviceLog->reservationId,
            'attended_by'    => $serviceLog->attendedBy,
            'created_by'     => $serviceLog->createdBy,
            'started_at'     => $serviceLog->startedAt->format('Y-m-d H:i:s'),
            'finished_at'    => $serviceLog->finishedAt?->format('Y-m-d H:i:s'),
            'price_charged'  => $serviceLog->priceCharged,
            'payment_method' => $serviceLog->paymentMethod,
            'status'         => $serviceLog->status,
            'notes'          => $serviceLog->notes,
            'log_date'       => $serviceLog->logDate,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $serviceLog->id ?: (string) Str::uuid();
            $model = ServiceLogModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function complete(string $id, \DateTimeImmutable $finishedAt): void
    {
        ServiceLogModel::where('id', $id)->update([
            'status'      => 'completed',
            'finished_at' => $finishedAt->format('Y-m-d H:i:s'),
        ]);
    }

    public function getDailySummary(string $tenantId, string $date): array
    {
        $rows = ServiceLogModel::whereDate('log_date', $date)->get();

        $reservations = \App\Infrastructure\Persistence\Models\ReservationModel::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereDate('scheduled_at', $date)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->with('service')
            ->get();

        $serviceRevenue = (float) $rows->sum('price_charged');
        $reservationRevenue = (float) $reservations->sum(fn ($r) => $r->service?->price ?? 0);

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
            'total_washes'       => $rows->count() + $reservations->count(),
            'total_revenue'      => $serviceRevenue + $reservationRevenue,
            'by_payment_method'  => $byPaymentMethod,
            'by_status'          => $byStatus,
        ];
    }

    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = ServiceLogModel::orderBy('started_at', 'desc');

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
            'data'         => $paginator->map(fn (ServiceLogModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(ServiceLogModel $model): ServiceLog
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
