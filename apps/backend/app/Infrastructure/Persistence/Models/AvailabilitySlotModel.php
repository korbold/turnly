<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AvailabilitySlotModel extends Model
{
    use HasUuids, HasFactory;

    protected $table = 'availability_slots';

    protected $fillable = [
        'tenant_id', 'day_of_week', 'start_time', 'end_time',
        'max_concurrent', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
            'max_concurrent' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope());
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\AvailabilitySlotModelFactory::new();
    }
}
