<?php

namespace App\Infrastructure\Persistence\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (app()->has('current_tenant_id')) {
            $builder->where($model->getTable() . '.tenant_id', app('current_tenant_id'));
        }
    }
}
