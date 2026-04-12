<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationModel extends Model
{
    use HasUuids, HasFactory, SoftDeletes;

    protected $table = 'reservations';

    protected $fillable = [
        'tenant_id', 'client_id', 'client_resource_id', 'service_id',
        'assigned_to', 'scheduled_at', 'estimated_end', 'status',
        'notes', 'cancelled_at', 'cancel_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'estimated_end' => 'datetime',
            'cancelled_at' => 'datetime',
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

    public function client()
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }

    public function clientResource()
    {
        return $this->belongsTo(ClientResourceModel::class, 'client_resource_id');
    }

    public function service()
    {
        return $this->belongsTo(ServiceModel::class, 'service_id');
    }

    public function assignedEmployee()
    {
        return $this->belongsTo(UserModel::class, 'assigned_to');
    }

    public function creator()
    {
        return $this->belongsTo(UserModel::class, 'created_by');
    }

    public function washLog()
    {
        return $this->hasOne(WashLogModel::class, 'reservation_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\ReservationModelFactory::new();
    }
}
