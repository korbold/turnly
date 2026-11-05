<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TenantUserModel extends Model
{
    use HasUuids;

    protected $table = 'tenant_users';

    protected $fillable = ['tenant_id', 'user_id', 'role', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** Quien trabaja en el negocio. `client` también tiene fila aquí, pero no es personal. */
    public const STAFF_ROLES = ['owner', 'tenant_admin', 'cashier', 'washer'];

    /** Personal activo del negocio, o super-admin. */
    public static function isStaff(?UserModel $user, ?string $tenantId): bool
    {
        if (!$user || !$tenantId) {
            return false;
        }

        return $user->is_super_admin
            || static::where('tenant_id', $tenantId)
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->whereIn('role', self::STAFF_ROLES)
                ->exists();
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'user_id');
    }
}
