<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Plan\Contracts\PlanRepositoryInterface;
use App\Domain\Plan\Entities\Plan;
use App\Infrastructure\Persistence\Models\PlanModel;
use Illuminate\Support\Str;

class EloquentPlanRepository implements PlanRepositoryInterface
{
    public function findById(string $id): ?Plan
    {
        $model = PlanModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findBySlug(string $slug): ?Plan
    {
        $model = PlanModel::where('slug', $slug)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function all(): array
    {
        return PlanModel::orderBy('sort_order')
            ->get()
            ->map(fn (PlanModel $m) => $this->mapToEntity($m))
            ->all();
    }

    public function save(Plan $plan): Plan
    {
        $model = PlanModel::find($plan->id);

        $data = [
            'name'                       => $plan->name,
            'slug'                       => $plan->slug,
            'price'                      => $plan->price,
            'max_services'               => $plan->maxServices,
            'max_reservations_per_month' => $plan->maxReservationsPerMonth,
            'max_employees'              => $plan->maxEmployees,
            'has_push_notifications'     => $plan->hasPushNotifications,
            'has_reports'                => $plan->hasReports,
            'has_reminders'              => $plan->hasReminders,
            'has_custom_page'            => $plan->hasCustomPage,
            'is_active'                  => $plan->isActive,
            'sort_order'                 => $plan->sortOrder,
            'description'                => $plan->description,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $plan->id ?: (string) Str::uuid();
            $model = PlanModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function delete(string $id): void
    {
        PlanModel::where('id', $id)->delete();
    }

    private function mapToEntity(PlanModel $model): Plan
    {
        return new Plan(
            id: $model->id,
            name: $model->name,
            slug: $model->slug,
            price: (float) $model->price,
            maxServices: $model->max_services,
            maxReservationsPerMonth: $model->max_reservations_per_month,
            maxEmployees: $model->max_employees,
            hasPushNotifications: $model->has_push_notifications,
            hasReports: $model->has_reports,
            hasReminders: $model->has_reminders,
            hasCustomPage: $model->has_custom_page,
            isActive: $model->is_active,
            sortOrder: $model->sort_order,
            description: $model->description,
        );
    }
}
