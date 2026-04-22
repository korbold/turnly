<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlanModel extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'plans';

    protected $fillable = [
        'name', 'slug', 'price',
        'max_services', 'max_reservations_per_month', 'max_employees',
        'has_push_notifications', 'has_reports', 'has_reminders', 'has_custom_page',
        'is_active', 'sort_order', 'description',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'max_services' => 'integer',
            'max_reservations_per_month' => 'integer',
            'max_employees' => 'integer',
            'has_push_notifications' => 'boolean',
            'has_reports' => 'boolean',
            'has_reminders' => 'boolean',
            'has_custom_page' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function tenants()
    {
        return $this->hasMany(TenantModel::class, 'plan_id');
    }
}
