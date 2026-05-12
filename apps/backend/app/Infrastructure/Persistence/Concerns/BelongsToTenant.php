<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Concerns;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Builder;
use InvalidArgumentException;

/**
 * Tenant-scoped Eloquent helper.
 *
 * Models that include this trait have the global TenantScope applied
 * automatically and gain a `forTenant($tenantId)` scope that explicitly
 * pins a query to a tenant. Use forTenant() instead of the brittle
 * `withoutGlobalScopes()->where('tenant_id', $id)` pair: forgetting the
 * second half leaks data across tenants, which the explicit helper makes
 * impossible.
 */
trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope());
    }

    /**
     * Pin a query to a specific tenant, bypassing any ambient
     * current_tenant_id binding. Throws when no tenant id is provided
     * to prevent accidental cross-tenant queries.
     */
    public function scopeForTenant(Builder $query, ?string $tenantId): Builder
    {
        if (empty($tenantId)) {
            throw new InvalidArgumentException(
                'forTenant() requires a non-empty tenant id; refusing to '
                . 'run an unscoped query.'
            );
        }

        return $query->withoutGlobalScopes()
            ->where($this->getTable() . '.tenant_id', $tenantId);
    }
}
