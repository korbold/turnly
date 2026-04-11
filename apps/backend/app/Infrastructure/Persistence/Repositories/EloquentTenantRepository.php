<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Domain\Tenant\Entities\Tenant;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Str;

class EloquentTenantRepository implements TenantRepositoryInterface
{
    public function findById(string $id): ?Tenant
    {
        $model = TenantModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findBySlug(string $slug): ?Tenant
    {
        $model = TenantModel::where('slug', $slug)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByEmail(string $email): ?Tenant
    {
        $model = TenantModel::where('email', $email)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function slugExists(string $slug): bool
    {
        return TenantModel::where('slug', $slug)->exists();
    }

    public function save(Tenant $tenant): Tenant
    {
        $model = TenantModel::find($tenant->id);

        $data = [
            'slug'             => $tenant->slug,
            'name'             => $tenant->name,
            'owner_name'       => $tenant->ownerName,
            'email'            => $tenant->email,
            'phone'            => $tenant->phone,
            'city'             => $tenant->city,
            'country'          => $tenant->country,
            'plan'             => $tenant->plan,
            'status'           => $tenant->status,
            'trial_ends_at'    => $tenant->trialEndsAt,
            'settings'         => $tenant->settings,
            'onboarding_step'  => $tenant->onboardingStep,
            'activated_at'     => $tenant->activatedAt,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $tenant->id ?: (string) Str::uuid();
            $model = TenantModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function updateStatus(string $id, string $status): void
    {
        TenantModel::where('id', $id)->update(['status' => $status]);
    }

    public function updateSettings(string $id, array $settings): void
    {
        TenantModel::where('id', $id)->update(['settings' => $settings]);
    }

    public function all(int $perPage = 15): array
    {
        $paginator = TenantModel::paginate($perPage);

        return [
            'data'         => $paginator->map(fn (TenantModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(TenantModel $model): Tenant
    {
        return new Tenant(
            id: $model->id,
            slug: $model->slug,
            name: $model->name,
            ownerName: $model->owner_name,
            email: $model->email,
            phone: $model->phone,
            city: $model->city,
            country: $model->country,
            plan: $model->plan,
            status: $model->status,
            trialEndsAt: $model->trial_ends_at
                ? \DateTimeImmutable::createFromMutable($model->trial_ends_at->toDateTime())
                : null,
            settings: $model->settings,
            onboardingStep: $model->onboarding_step,
            activatedAt: $model->activated_at
                ? \DateTimeImmutable::createFromMutable($model->activated_at->toDateTime())
                : null,
        );
    }
}
