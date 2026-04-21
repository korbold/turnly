<?php

namespace App\Infrastructure\Persistence\Models;

use App\Domain\Notification\Enums\DevicePlatform;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DeviceTokenModel extends Model
{
    use HasUuids;

    protected $table = 'device_tokens';

    protected $fillable = [
        'user_id',
        'tenant_id',
        'platform',
        'token',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'platform' => DevicePlatform::class,
            'is_active' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'user_id');
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }
}
