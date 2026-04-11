<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VehicleModel extends Model
{
    use HasUuids, HasFactory, SoftDeletes;

    protected $table = 'vehicles';

    protected $fillable = [
        'tenant_id', 'owner_id', 'plate', 'brand', 'model', 'color', 'type',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope());
    }

    public function owner()
    {
        return $this->belongsTo(UserModel::class, 'owner_id');
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    public function washLogs()
    {
        return $this->hasMany(WashLogModel::class, 'vehicle_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\VehicleModelFactory::new();
    }
}
