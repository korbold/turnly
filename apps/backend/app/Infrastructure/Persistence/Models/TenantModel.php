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
        'city', 'country', 'plan_id', 'is_trial', 'status',
        'trial_ends_at', 'settings', 'onboarding_step', 'activated_at',
        'business_type', 'custom_fields', 'description', 'address',
        'logo_url', 'cover_url', 'social_links', 'brand_theme',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'trial_ends_at' => 'datetime',
            'activated_at' => 'datetime',
            'onboarding_step' => 'integer',
            'custom_fields' => 'array',
            'social_links' => 'array',
            'is_trial' => 'boolean',
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

    public function images()
    {
        return $this->hasMany(TenantImageModel::class, 'tenant_id')->orderBy('sort_order');
    }

    public function plan()
    {
        return $this->belongsTo(PlanModel::class, 'plan_id');
    }

    // Factory linkage
    protected static function newFactory()
    {
        return \Database\Factories\TenantModelFactory::new();
    }
}
