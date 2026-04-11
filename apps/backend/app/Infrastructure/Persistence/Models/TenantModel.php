<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TenantModel extends Model
{
    use HasUuids, HasFactory, SoftDeletes;

    protected $table = 'tenants';

    protected $fillable = [
        'slug', 'name', 'owner_name', 'email', 'phone',
        'city', 'country', 'plan', 'status',
        'trial_ends_at', 'settings', 'onboarding_step', 'activated_at',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'trial_ends_at' => 'datetime',
            'activated_at' => 'datetime',
            'onboarding_step' => 'integer',
        ];
    }

    public function users()
    {
        return $this->belongsToMany(UserModel::class, 'tenant_users', 'tenant_id', 'user_id')
            ->withPivot('role', 'is_active')
            ->withTimestamps();
    }

    public function services()
    {
        return $this->hasMany(ServiceModel::class, 'tenant_id');
    }

    public function availabilitySlots()
    {
        return $this->hasMany(AvailabilitySlotModel::class, 'tenant_id');
    }

    // Factory linkage
    protected static function newFactory()
    {
        return \Database\Factories\TenantModelFactory::new();
    }
}
