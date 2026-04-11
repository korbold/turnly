<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\User\Contracts\UserRepositoryInterface;
use App\Domain\User\Entities\User;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

class EloquentUserRepository implements UserRepositoryInterface
{
    public function findById(string $id): ?User
    {
        $model = UserModel::find($id);

        return $model ? $this->mapToEntity($model) : null;
    }

    public function findByEmail(string $email): ?User
    {
        $model = UserModel::where('email', $email)->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    public function save(User $user): User
    {
        $model = UserModel::find($user->id);

        $data = [
            'name'           => $user->name,
            'email'          => $user->email,
            'phone'          => $user->phone,
            'is_super_admin' => $user->isSuperAdmin,
        ];

        if ($model) {
            $model->update($data);
            $model->refresh();
        } else {
            $id = $user->id ?: (string) Str::uuid();
            $model = UserModel::create(array_merge(['id' => $id], $data));
        }

        return $this->mapToEntity($model);
    }

    public function findByTenant(string $tenantId, int $perPage = 15): array
    {
        $paginator = UserModel::whereHas('tenants', function ($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId);
        })->paginate($perPage);

        return [
            'data'         => $paginator->map(fn (UserModel $m) => $this->mapToEntity($m))->all(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    private function mapToEntity(UserModel $model): User
    {
        return new User(
            id: $model->id,
            name: $model->name,
            email: $model->email,
            phone: $model->phone,
            isSuperAdmin: (bool) $model->is_super_admin,
        );
    }
}
