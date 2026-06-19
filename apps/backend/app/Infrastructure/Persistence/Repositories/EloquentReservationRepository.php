<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\Reservation\Entities\Reservation;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Support\Str;

class EloquentReservationRepository implements ReservationRepositoryInterface
{
    public function findById(string $id): ?Reservation
    {
        $model = ReservationModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByTenantAndDate(string $tenantId, string $date): array
    {
        return ReservationModel::whereDate('scheduled_at', $date)
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (ReservationModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function findConflicting(
        string $tenantId,
        \DateTimeImmutable $start,
        \DateTimeImmutable $end,
        ?string $excludeId = null
    ): array {
        $query = ReservationModel::where('scheduled_at', '<', $end->format('Y-m-d H:i:s'))
            ->where('estimated_end', '>', $start->format('Y-m-d H:i:s'))
            ->whereNotIn('status', [
                ReservationStatus::Cancelled->value,
                ReservationStatus::NoShow->value,
            ]);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->get()
            ->map(fn (ReservationModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(Reservation $reservation): Reservation
    {
        $model = ReservationModel::find($reservation->id);

        $data = [
            'tenant_id'     => $reservation->tenantId,
            'client_id'     => $reservation->clientId,
            'client_resource_id'    => $reservation->clientResourceId,
            'business_resource_id'  => $reservation->businessResourceId,
            'service_id'    => $reservation->serviceId,
            'assigned_to'   => $reservation->assignedTo,
            'scheduled_at'  => $reservation->scheduledAt->format('Y-m-d H:i:s'),
            'estimated_end' => $reservation->estimatedEnd->format('Y-m-d H:i:s'),
            'status'        => $reservation->status->value,
            'notes'         => $reservation->notes,
            'cancelled_at'  => $reservation->cancelledAt?->format('Y-m-d H:i:s'),
            'cancel_reason' => $reservation->cancelReason,
            'created_by'    => $reservation->createdBy,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $reservation->id ?: (string) Str::uuid();
            $model = ReservationModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function updateStatus(string $id, ReservationStatus $status, ?string $cancelReason = null): void
    {
        $data = ['status' => $status->value];

        if (in_array($status, [ReservationStatus::Cancelled, ReservationStatus::NoShow])) {
            $data['cancelled_at'] = now();
            if ($cancelReason !== null) {
                $data['cancel_reason'] = $cancelReason;
            }
        }

        ReservationModel::where('id', $id)->update($data);
    }

    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = ReservationModel::orderBy('scheduled_at', 'desc');

        if (!empty($filters['date'])) {
            $query->whereDate('scheduled_at', $filters['date']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['service_id'])) {
            $query->where('service_id', $filters['service_id']);
        }

        $paginator = $query->paginate($perPage);

        return [
            'data'         => $paginator->map(fn (ReservationModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(ReservationModel $model): Reservation
    {
        return new Reservation(
            id: $model->id,
            tenantId: $model->tenant_id,
            clientId: $model->client_id,
            clientResourceId: $model->client_resource_id,
            businessResourceId: $model->business_resource_id,
            serviceId: $model->service_id,
            assignedTo: $model->assigned_to,
            scheduledAt: \DateTimeImmutable::createFromMutable($model->scheduled_at->toDateTime()),
            estimatedEnd: \DateTimeImmutable::createFromMutable($model->estimated_end->toDateTime()),
            status: ReservationStatus::from($model->status),
            notes: $model->notes,
            cancelledAt: $model->cancelled_at
                ? \DateTimeImmutable::createFromMutable($model->cancelled_at->toDateTime())
                : null,
            cancelReason: $model->cancel_reason,
            createdBy: $model->created_by,
        );
    }
}
