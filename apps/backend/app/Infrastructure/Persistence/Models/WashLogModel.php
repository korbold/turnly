<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WashLogModel extends Model
{
    use HasUuids, HasFactory;

    protected $table = 'wash_logs';

    protected $fillable = [
        'tenant_id', 'vehicle_id', 'service_id', 'reservation_id',
        'attended_by', 'created_by', 'started_at', 'finished_at',
        'price_charged', 'payment_method', 'status', 'notes', 'log_date',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'price_charged' => 'decimal:2',
            'log_date' => 'date',
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

    public function vehicle()
    {
        return $this->belongsTo(VehicleModel::class, 'vehicle_id');
    }

    public function service()
    {
        return $this->belongsTo(ServiceModel::class, 'service_id');
    }

    public function reservation()
    {
        return $this->belongsTo(ReservationModel::class, 'reservation_id');
    }

    public function attendant()
    {
        return $this->belongsTo(UserModel::class, 'attended_by');
    }

    public function creator()
    {
        return $this->belongsTo(UserModel::class, 'created_by');
    }

    protected static function newFactory()
    {
        return \Database\Factories\WashLogModelFactory::new();
    }
}
