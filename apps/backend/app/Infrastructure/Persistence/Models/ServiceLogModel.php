<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceLogModel extends Model
{
    use HasUuids, HasFactory, BelongsToTenant;

    protected $table = 'service_logs';

    protected $fillable = [
        'tenant_id', 'client_resource_id', 'service_id', 'reservation_id',
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

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    public function clientResource()
    {
        return $this->belongsTo(ClientResourceModel::class, 'client_resource_id');
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
        return \Database\Factories\ServiceLogModelFactory::new();
    }
}
