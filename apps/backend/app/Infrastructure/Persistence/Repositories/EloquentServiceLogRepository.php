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

        $reservations = \App\Infrastructure\Persistence\Models\ReservationModel::query()
            ->forTenant($tenantId)
            ->whereDate('scheduled_at', $date)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->with('service')
            ->get();

        $reservationPrice = fn ($r) => (float) ($r->service?->price ?? 0);

        $serviceRevenue = (float) $rows->sum('price_charged');
        $reservationRevenue = (float) $reservations->sum($reservationPrice);

        // Los tiles cuentan plata recibida, no precios de servicios. Con
        // abonos parciales esas dos cifras dejan de coincidir, y la que le
        // importa a la caja es la primera. Se filtra por `paid_at`: un
        // servicio de ayer cobrado hoy es plata de hoy.
        //
        // Mirrors the enum the cashier picks from; leaving `other` out
        // meant those sales landed in the revenue figure with no tile
        // accounting for them.
        $pagosDelDia = \App\Infrastructure\Persistence\Models\PaymentModel::query()
            ->forTenant($tenantId)
            ->whereDate('paid_at', $date)
            ->get();

        $byPaymentMethod = [];
        foreach (['cash', 'card', 'transfer', 'other'] as $method) {
            $subset = $pagosDelDia->where('method', $method);
            $byPaymentMethod[$method] = [
                'count' => $subset->count(),
                'total' => (float) $subset->sum('amount'),
            ];
        }

        $byStatus = [
            'in_progress' => $rows->where('status', 'in_progress')->count(),
            'completed'   => $rows->where('status', 'completed')->count(),
        ];

        // Money in the till vs money still owed. Both service logs and
        // reservations run payment on a track of their own — "cobrar al
        // retirar" leaves either one unpaid — so each figure has to split both
        // sources. Deriving one from the other in the client would bill an
        // unpaid reservation as collected, since reservations default to unpaid.
        $unpaidRows         = $rows->where('payment_status', 'unpaid');
        $paidReservations   = $reservations->where('payment_status', 'paid');
        $unpaidReservations = $reservations->where('payment_status', 'unpaid');

        return [
            'total_washes'       => $rows->count() + $reservations->count(),
            // Everything registered today, collected or not.
            'total_revenue'      => $serviceRevenue + $reservationRevenue,
            'by_payment_method'  => $byPaymentMethod,
            'by_status'          => $byStatus,
            'collected'          => [
                'count' => $pagosDelDia->count() + $paidReservations->count(),
                'total' => (float) $pagosDelDia->sum('amount')
                    + (float) $paidReservations->sum($reservationPrice),
            ],
            'unpaid'             => [
                'count' => $unpaidRows->count() + $unpaidReservations->count(),
                'total' => (float) $unpaidRows->sum('price_charged')
                    + (float) $unpaidReservations->sum($reservationPrice),
            ],
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
